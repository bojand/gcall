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
const concat = require('concat-stream')
const grpc = require('grpc')
const JSONStream = require('JSONStream')
const fs = require('fs')
const os = require('os')
const yaml = require('js-yaml')
const Stringify = require('streaming-json-stringify')

program
  .version(version)
  .usage('[options] <method>')
  .option('-p, --proto <file>', 'Path to protocol buffer definition.')
  .option('-S, --service <name>', 'Service name. Default is the 0th found in definition.')
  .option('-h, --host <host>', 'The service host.')
  .option('-d, --data <data>', 'Input data, otherwise standard input.')
  .option('-s, --secure', 'Use secure options.')
  .option('-o, --output <file>', 'Output path, otherwise standard output.')
  .option('-j, --json [jsonpath]', 'JSONPath for request stream parsing. Default: \'*\'.', '*')
  .option('-b, --breaker [characters]', 'Separator character(s) for JSON stream response. If flag set, but no separator is defined, default newline is used as separator.', false)
  .option('-a, --array', 'Output response stream as an array. Default: false.')
  .option('-m, --metadata <data>', 'Metadata value.', JSON.parse)
  .option('-c, --config <file>', 'Config file with options.')
  .option('-C, --color', 'Color output. Useful for terminal output.')
  .option('-P, --pretty', 'Pretty print output.')
  .parse(process.argv)

const configFile = program.config
let config = {}
if (configFile && typeof configFile === 'string') {
  config = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'))
}

const PROPS = [ 'proto', 'service', 'host', 'data', 'secure', 'output', 'json', 'array', 'breaker',
  'metadata', 'color', 'pretty' ]

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
  metadata = {}
} = options

if (!proto) {
  console.error('Must provide proto file.')
  return process.exit(128)
}

const methodName = program.args[0]

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
  console.error('Method name required.')
  return process.exit(128)
}

const clientOptions = secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()
const client = caller(host, proto, serviceName, clientOptions)
const clientMethodName = camelCase(methodName)
const methodExist =
  (d.methodNames(serviceName).indexOf(methodName) >= 0) &&
  (typeof client[clientMethodName] === 'function')

if (!methodExist) {
  console.error('Method \'%s\' does not exist for service %s.', methodName, serviceName)
  return process.exit(128)
}

const methodDesc = find(gservice.methods, { name: methodName })
const input = data ? str2stream(data) : process.stdin

if (!methodDesc.requestStream && !methodDesc.responseStream) {
  const handler = concat(inputData => {
    const payload = getRequestPayload(inputData)
    const res = client[clientMethodName](payload, metadata)
    res.then(writeOutput, errorHandler)
  })
  input.on('error', errorHandler)
  input.pipe(handler)
} else if (methodDesc.requestStream && !methodDesc.responseStream) {
  const { call, res } = client[clientMethodName](metadata)
  res.then(writeOutput, errorHandler)
  handleInputStream(input, call)
} else if (!methodDesc.requestStream && methodDesc.responseStream) {
  const out = output ? fs.createWriteStream(output) : process.stdout
  const handler = concat(inputData => {
    const payload = getRequestPayload(inputData)
    const call = client[clientMethodName](payload, metadata)
    handleOutputStream(call, out)
  })
  input.on('error', errorHandler)
  input.pipe(handler)
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
  if (output) {
    const outputStr = pretty
      ? util.inspect(res, { depth: 10 })
      : JSON.stringify(res)
    fs.writeFile(output, outputStr, err => {
      if (err) errorHandler(err)
      else process.exit(0)
    })
  } else {
    const outputStr = pretty
      ? util.inspect(res, { depth: 10, colors: color })
      : JSON.stringify(res)
    console.log(outputStr)
    process.exit(0)
  }
}

function getRequestPayload (inputData) {
  let payload
  try {
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
  input
    .pipe(JSONStream.parse(json))
    .pipe(call)
    .on('error', errorHandler)

  if (end) {
    input.on('end', () => call.end())
  }
}

function handleOutputStream (call, out) {
  const stringify = Stringify()
  stringify.opener = ''
  stringify.seperator = ','
  stringify.closer = ''

  if (pretty) {
    if (color) stringify.stringifier = data => util.inspect(data, { colors: color, depth: 10 })
    else stringify.space = 2
  }

  if (array) {
    if (pretty) {
      stringify.opener = '[' + os.EOL
      stringify.seperator = os.EOL + ',' + os.EOL
      stringify.closer = os.EOL + ']' + os.EOL
    } else {
      stringify.opener = '['
      if (breaker === true) stringify.seperator = os.EOL + ',' + os.EOL
      else if (typeof breaker === 'string') stringify.seperator = breaker
      else stringify.seperator = ','
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
