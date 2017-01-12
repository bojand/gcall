#!/usr/bin/env node

const { version } = require('./package.json')
const program = require('commander')
const gi = require('grpc-inspect')
const chalk = require('chalk')
const util = require('util')
const figures = require('figures')
const str2stream = require('string-to-stream')
const caller = require('grpc-caller')
const camelCase = require('lodash.camelcase')
const find = require('lodash.find')
const pick = require('lodash.pick')
const assign = require('lodash.assign')
const readall = require('readall')
const grpc = require('grpc')
const JSONStream = require('JSONStream')
const fs = require('fs')
const os = require('os')
const yaml = require('js-yaml')
const Stringify = require('streaming-json-stringify')

program
  .version(version)
  .usage('[options] <rpc>')
  .option('-p, --proto <file>', 'Path to protocol buffer definition.')
  .option('-h, --host <host>', 'The service host.')
  .option('-d, --data <data>', 'Input data, otherwise standard input.')
  .option('-o, --output <file>', 'Output path, otherwise standard output.')
  .option('-m, --metadata <data>', 'Metadata value.', JSON.parse)
  .option('-s, --secure', 'Use secure options.')
  .option('-S, --service <name>', 'Service name. Default is the 0th found in definition.')
  .option('-j, --json [jsonpath]', 'Input is JSON. JSONPath for parsing. Default: \'*\'. Set to empty to turn off JSON parsing.', '*')
  .option('-b, --breaker [characters]', 'Separator character(s) for JSON stream response. If flag set, but no separator is defined, default newline is used as separator.', false)
  .option('-a, --array', 'Output response stream as an array. Default: false.')
  .option('-r, --rpc <name>', 'RPC to call.')
  .option('-c, --config <file>', 'YAML or JSON config file with all the options.')
  .option('-C, --color', 'Color output. Useful for terminal output.')
  .option('-P, --pretty', 'Pretty print output.')
  .option('-R, --raw', 'Raw output. Do not try to JSON stringify or do anything.')
  .option('-E, --encoding [encoding]', 'Encoding for raw mode file output. Default: utf8.', 'utf8')
  .option('-X, --silent', 'Silent. Do not output anything. Just do the call.')
  .parse(process.argv)

const configFile = program.config
let config = {}
if (configFile && typeof configFile === 'string') {
  config = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'))
}

const PROPS = [ 'proto', 'service', 'host', 'data', 'secure', 'output', 'json', 'array', 'breaker',
  'metadata', 'color', 'pretty', 'silent', 'rpc', 'raw', 'encoding' ]

const options = assign({}, config, pick(program, PROPS))

const {
  proto,
  service,
  host,
  data,
  secure,
  output,
  json,
  array,
  breaker,
  color,
  pretty,
  silent,
  rpc,
  raw,
  encoding,
  metadata = {}
} = options

if (!proto) {
  console.error('Must provide proto file.')
  return process.exit(128)
}

const methodName = program.args[0] || rpc

const d = gi(proto)
const serviceName = service || d.serviceNames()[0]
let gservice = null
if (service) {
  gservice = d.service(serviceName)
} else {
  gservice = d.service(serviceName)
}

if (!gservice) {
  console.error('Service \'%s\' does not exist in protocol buffer definition.', serviceName)
  return process.exit(128)
}

if (!host) {
  // only list methods for service
  gservice.methods.forEach(md => console.log(getCallDescription(md)))
  process.exit(0)
}

if (!methodName) {
  console.error('RPC method name required.')
  return process.exit(128)
}

const clientOptions = secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()
const client = caller(host, proto, serviceName, clientOptions)
const clientMethodName = camelCase(methodName)
const methodExist =
  (d.methodNames(serviceName).indexOf(methodName) >= 0) &&
  (typeof client[clientMethodName] === 'function')

if (!methodExist) {
  console.error('RPC method \'%s\' does not exist for service %s.', methodName, serviceName)
  return process.exit(128)
}

const methodDesc = find(gservice.methods, { name: methodName })

const dataStr =
  typeof data === 'string'
  ? data
  : json
    ? JSON.stringify(data)
    : data.toString()

const input = data ? str2stream(dataStr) : process.stdin

if (!methodDesc.requestStream && !methodDesc.responseStream) {
  input.on('error', errorHandler)
  readall(input, (err, inputData) => {
    if (err) {
      return errorHandler(err)
    }

    const payload = getRequestPayload(inputData)
    const res = client[clientMethodName](payload, metadata)
    res.then(writeOutput, errorHandler)
  })
} else if (methodDesc.requestStream && !methodDesc.responseStream) {
  const { call, res } = client[clientMethodName](metadata)
  res.then(writeOutput, errorHandler)
  handleInputStream(input, call)
} else if (!methodDesc.requestStream && methodDesc.responseStream) {
  const out = output ? fs.createWriteStream(output) : process.stdout
  input.on('error', errorHandler)
  readall(input, (err, inputData) => {
    if (err) {
      return errorHandler(err)
    }

    const payload = getRequestPayload(inputData)
    const call = client[clientMethodName](payload, metadata)
    handleOutputStream(call, out)
  })
} else if (methodDesc.requestStream && methodDesc.responseStream) {
  const out = output ? fs.createWriteStream(output) : process.stdout
  const call = client[clientMethodName](metadata)
  handleInputStream(input, call, false)
  handleOutputStream(call, out)
} else {
  console.error('Unsupported call type.')
  process.exit(128)
}

function getCallDescription (callDesc) {
  const { name, requestStream, responseStream, requestName, responseName } = callDesc
  const reqName = color ? chalk.blue(requestName) : requestName
  const resName = color ? chalk.green(responseName) : responseName
  const streamStr = color ? chalk.gray('stream ') : 'stream '
  const reqDesc = requestStream ? streamStr + reqName : reqName
  const resDesc = responseStream ? streamStr + resName : resName
  const nameStr = color ? chalk.bold(name) : name
  return util.format('%s %s (%s) returns (%s)', figures.pointerSmall, nameStr, reqDesc, resDesc)
}

function writeOutput (res) {
  if (silent) {
    return process.exit(0)
  }

  if (output) {
    const outputStr = raw ? res : JSON.stringify(res, null, pretty ? 2 : 0)
    fs.writeFile(output, outputStr, encoding, err => {
      if (err) {
        errorHandler(err)
      } else {
        process.exit(0)
      }
    })
  } else {
    let outputStr
    if (color) {
      outputStr = util.inspect(res, { depth: 10, colors: true })
    } else {
      outputStr = raw ? res : JSON.stringify(res, null, pretty ? 2 : 0)
    }
    console.log(outputStr)
    process.exit(0)
  }
}

function getRequestPayload (inputData) {
  if (!json) {
    return inputData
  }

  let payload
  try {
    if (typeof inputData !== 'string') {
      inputData = inputData.toString()
    }
    payload = JSON.parse(inputData)
  } catch (err) {
    console.error('Input must be valid JSON.')
    return process.exit(128)
  }
  return payload
}

function errorHandler (err) {
  console.error(err)
  process.exit(129)
}

function handleInputStream (input, call, end = true) {
  if (json) {
    input = input.pipe(JSONStream.parse(json))
  }

  input
    .pipe(call)
    .on('error', errorHandler)

  if (end) {
    input.on('end', () => call.end())
  }
}

function handleOutputStream (call, out) {
  if (silent) {
    call
      .on('data', noop)
      .on('end', () => process.exit(0))
      .on('error', errorHandler)
  } else if (raw) {
    call
      .pipe(out)
      .on('end', () => process.exit(0))
      .on('error', errorHandler)
  } else {
    const stringify = Stringify()
    stringify.opener = ''
    stringify.seperator = ','
    stringify.closer = ''

    if (pretty) {
      stringify.seperator = ', '
      stringify.space = 2
    }

    if (color) {
      stringify.stringifier = data => util.inspect(data, { colors: color, depth: 10 })
      if (pretty) {
        stringify.seperator = os.EOL
      }
    }

    if (array) {
      if (pretty) {
        stringify.opener = '[' + os.EOL
        stringify.seperator = ',' + os.EOL
        stringify.closer = os.EOL + ']' + os.EOL
        stringify.stringifier = (data, replacer, space) => {
          const r = os.EOL + ' '.repeat(space)
          const t = JSON.stringify(data, null, space)
          return ' '.repeat(space) + t.replace(/\r?\n|\r/g, r)
        }
      } else {
        stringify.opener = '['
        if (breaker === true) {
          stringify.seperator = os.EOL + ',' + os.EOL
        } else if (typeof breaker === 'string') {
          stringify.seperator = breaker
        } else {
          stringify.seperator = ','
        }
        stringify.closer = ']'
      }
    } else if (breaker === true) {
      stringify.seperator = os.EOL
    } else if (typeof breaker === 'string') {
      stringify.seperator = breaker
    }

    call
      .pipe(stringify)
      .pipe(out)
      .on('end', () => process.exit(0))
      .on('error', errorHandler)
  }
}

function noop () {}
