#!/usr/bin/env node

const {version} = require('../package.json')
const program = require('commander')
const gi = require('grpc-inspect')
const chalk = require('chalk')
const util = require('util')
const figures = require('figures')
const str2stream = require('string-to-stream')
const caller = require('grpc-caller')
const camelCase = require('lodash.camelcase')

program.version(version).usage('[options] <method>').option('-p, --proto <file>', 'Path to protocol buffer definition').option('-S, --service <name>', 'Service name').option('-h, --host <host>', 'The service host').option('-d, --data <data>', 'Input data, otherwise standard input').option('-s, --secure', 'Use secure option').option('-o, --output', 'Output path, otherwise standard output').option('-m, --metadata <metadata data>', 'Metadata value', JSON.parse).parse(process.argv)

const {
  proto,
  service,
  data,
  host,
  secure,
  output,
  metadata
} = program

console.dir(program.args)
console.dir(proto)
console.dir(service)
console.dir(data)
console.dir(host)
console.dir(secure)
console.dir(output)
console.dir(metadata)
console.log('======')

function getCallDescription (callDesc) {
  const {name, requestStream, responseStream, requestName, responseName} = callDesc
  const reqName = chalk.blue(requestName)
  const resName = chalk.green(responseName)
  const reqDesc = requestStream
    ? chalk.gray('stream ') + reqName
    : reqName
  const resDesc = responseStream
    ? chalk.gray('stream ') + resName
    : resName
  return util.format('%s %s (%s) returns (%s)', figures.pointerSmall, chalk.bold(name), reqDesc, chalk.green(resDesc))
}

if (!proto) {
  console.error('Must provide proto file')
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

if (!host) {
  // only list
  gservice.methods.forEach(md => console.log(getCallDescription(md)))
  process.exit(0)
}

const client = caller(host, proto, serviceName)
const clientMethodName = camelCase(methodName)
const methodExist =
  (d.methodNames(serviceName).indexOf(methodName) >= 0) &&
  (typeof client[clientMethodName] === 'function')

if (!methodExist) {
  console.error('Method %s does not exist for service %s', methodName, serviceName)
  return process.exit(128)
}

const input = data
  ? str2stream(data)
  : process.stdin

console.log('about to call clientMethodName')
