import _ from 'lodash'
import fs from 'fs'
import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc'
import pify from 'pify'
import exec from 'execa'

const readFile = pify(fs.readFile)

const PROTO_PATH = path.resolve(__dirname, './protos/reqres.proto')
const argProto = grpc.load(PROTO_PATH).argservice

const apps = []

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const DYNAMIC_HOST = getHost()
const OUTPUT_FILE = path.resolve(__dirname, './output/reqres.txt')

test.before('should dynamically create service', t => {
  function doSomething (call, callback) {
    const ret = { message: call.request.message }
    if (call.metadata) {
      const meta = call.metadata.getMap()
      if (meta['user-agent']) {
        delete meta['user-agent']
      }
      if (!_.isEmpty(meta)) {
        ret.metadata = JSON.stringify(meta)
      }
    }
    callback(null, ret)
  }

  const server = new grpc.Server()
  server.addProtoService(argProto.ArgService.service, { doSomething })
  server.bind(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure())
  server.start()
  apps.push(server)
})

test.beforeEach('truncate', t => {
  fs.truncateSync(OUTPUT_FILE)
})

test.serial('should call with -d data', async t => {
  t.plan(2)
  const data = { message: 'Hello' }
  const str = JSON.stringify(data)
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', str,
    '-o', OUTPUT_FILE,
    'DoSomething'
  ]
  const res = await exec('./gcall.js', args)
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = '{"message":"Hello","metadata":""}'
  t.is(actual, expected)
})

test.serial('should call with -d data -P pretty', async t => {
  t.plan(2)
  const data = { message: 'Hello' }
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify(data),
    '-o', OUTPUT_FILE,
    '-P',
    'DoSomething'
  ]
  const res = await exec('./gcall.js', args)
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = '{\n  "message": "Hello",\n  "metadata": ""\n}'
  t.is(actual, expected)
})

test.serial('should call with -d data -P and -m metadata', async t => {
  t.plan(2)
  const data = { message: 'Hello' }
  const metadata = { 'request-id': '1234' }
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify(data),
    '-m', JSON.stringify(metadata),
    '-o', OUTPUT_FILE,
    '-P',
    'DoSomething'
  ]
  const res = await exec('./gcall.js', args)
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = '{\n  "message": "Hello",\n  "metadata": "{\\"request-id\\":\\"1234\\"}"\n}'
  t.is(actual, expected)
})

test.serial('should call with stdin data', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    'DoSomething'
  ]

  const inputFile = path.resolve(__dirname, './data/message.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = '{"message":"Hello","metadata":""}'
  t.is(actual, expected)
})

test.serial('should call with stdin data and no output with -X', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    '-X',
    'DoSomething'
  ]

  const inputFile = path.resolve(__dirname, './data/message.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)
  t.is(res.stdout, '')
})

test.after.always.cb('guaranteed cleanup', t => {
  fs.truncateSync(OUTPUT_FILE)
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
