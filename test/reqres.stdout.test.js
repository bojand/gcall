import _ from 'lodash'
import fs from 'fs'
import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc'
import exec from 'execa'

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

test('should call with stdin data', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    'DoSomething'
  ]

  const inputFile = path.resolve(__dirname, './data/message.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  const i = res.stdout.indexOf('"message":"Hello"')
  t.true(i >= 0)
})

test('should call with stdin data and no output with -X', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-X',
    'DoSomething'
  ]

  const inputFile = path.resolve(__dirname, './data/message.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)
  t.is(res.stdout, '')
})

test('should call with -d data', async t => {
  t.plan(1)
  const data = { message: 'Hello' }
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify(data),
    'DoSomething'
  ]
  const res = await exec('./gcall.js', args)
  const i = res.stdout.indexOf('"message":"Hello"')
  t.true(i >= 0)
})

test('should call with -d data and add metadata using -m option', async t => {
  t.plan(3)
  const data = { message: 'Hello' }
  const metadata = { 'request-id': '1234' }
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify(data),
    '-m', JSON.stringify(metadata),
    'DoSomething'
  ]
  const res = await exec('./gcall.js', args)
  const i = res.stdout.indexOf('"message":"Hello"')
  t.true(i >= 0)
  const i2 = res.stdout.indexOf('metadata')
  t.true(i2 > i)
  const i3 = res.stdout.indexOf('{\\"request-id\\":\\"1234\\"}')
  t.true(i3 > i2)
})

test('should call with -d data and -r rpc', async t => {
  t.plan(1)
  const data = { message: 'Hello' }
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify(data),
    '-r', 'DoSomething'
  ]
  const res = await exec('./gcall.js', args)
  const i = res.stdout.indexOf('"message":"Hello"')
  t.true(i >= 0)
})

test('should call with -c JSON config file and -h host', async t => {
  t.plan(3)
  const args = [
    '-c', path.resolve(__dirname, './config/reqres.json'),
    '-h', DYNAMIC_HOST.toString()
  ]
  const res = await exec('./gcall.js', args)
  const i = res.stdout.indexOf('"message":"Hello"')
  t.true(i >= 0)
  const i2 = res.stdout.indexOf('metadata')
  t.true(i2 > i)
  const i3 = res.stdout.indexOf('{\\"request-id\\":\\"1234\\"}')
  t.true(i3 > i2)
})

test('should call with -c YAML config file and -h host', async t => {
  t.plan(3)
  const args = [
    '-c', path.resolve(__dirname, './config/reqres.yaml'),
    '-h', DYNAMIC_HOST.toString()
  ]
  const res = await exec('./gcall.js', args)
  const i = res.stdout.indexOf('"message":"Hello"')
  t.true(i >= 0)
  const i2 = res.stdout.indexOf('metadata')
  t.true(i2 > i)
  const i3 = res.stdout.indexOf('{\\"request-id\\":\\"1234\\"}')
  t.true(i3 > i2)
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
