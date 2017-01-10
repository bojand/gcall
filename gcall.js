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
const concat = require('concat-stream')
const grpc = require('grpc')
const JSONStream = require('JSONStream')
const fs = require('fs')

program
  .version(version)
  .usage('[options] <method>')
  .option('-p, --proto <file>', 'Path to protocol buffer definition.')
  .option('-S, --service <name>', 'Service name. Default is the 0th found in definition.')
  .option('-h, --host <host>', 'The service host.')
  .option('-d, --data <data>', 'Input data, otherwise standard input.')
  .option('-s, --secure', 'Use secure options.')
  .option('-o, --output <file>', 'Output path, otherwise standard output.')
  .option('-j, --json <jsonpath>', 'JSONPath for request stream parsing. Default: \'*\'.')
  .option('-a, --array', 'Output response stream as an array. Default: false. Outputs data separated by newlines.')
  .option('-m, --metadata <metadata data>', 'Metadata value.', JSON.parse)
  .parse(process.argv)

const {
  proto,
  service,
  host,
  data,
  secure,
  output,
  json = '*',
  array,
  metadata = {}
} = program

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
  const reqName = chalk.blue(requestName)
  const resName = chalk.green(responseName)
  const reqDesc = requestStream ? chalk.gray('stream ') + reqName : reqName
  const resDesc = responseStream ? chalk.gray('stream ') + resName : resName
  return util.format('%s %s (%s) returns (%s)', figures.pointerSmall, chalk.bold(name), reqDesc, resDesc)
}

function writeOutput (res) {
  if (output) {
    let fdata
    try {
      fdata = JSON.stringify(res)
    } catch (err) {
      return errorHandler(err)
    }
    fs.writeFile(output, fdata, err => {
      if (err) errorHandler(err)
      else process.exit(0)
    })
  } else {
    console.log(util.inspect(res, { colors: true }))
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
  call
    .pipe(JSONStream.stringify(array ? null : false))
    .pipe(out)
    .on('end', () => process.exit(0))
    .on('error', errorHandler)
}
