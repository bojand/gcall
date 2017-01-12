import _ from 'lodash'
import fs from 'fs'
import async from 'async'
import test from 'ava'
import path from 'path'
import grpc from 'grpc'
import exec from 'execa'

const PROTO_PATH = path.resolve(__dirname, './protos/reqstream.proto')
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
  function writeStuff (call, fn) {
    let meta = null
    if (call.metadata) {
      const reqMeta = call.metadata.getMap()
      if (reqMeta['user-agent']) {
        delete reqMeta['user-agent']
      }
      if (!_.isEmpty(reqMeta)) {
        meta = JSON.stringify(reqMeta)
      }
    }

    let counter = 0
    const received = []
    call.on('data', d => {
      counter += 1
      received.push(d.message)
    })

    call.on('end', () => {
      const ret = {
        message: received.join(':').concat(':' + counter)
      }

      if (meta) {
        ret.metadata = meta
      }
      fn(null, ret)
    })
  }

  const server = new grpc.Server()
  server.addProtoService(argProto.ArgService.service, { writeStuff })
  server.bind(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure())
  server.start()
  apps.push(server)
})

test('should call with stdin data', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/reqstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    'WriteStuff'
  ]

  const inputFile = path.resolve(__dirname, './data/messages.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '{"message":"1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6","metadata":""}')
})

test('should call with stdin data and -X', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/reqstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-X',
    'WriteStuff'
  ]

  const inputFile = path.resolve(__dirname, './data/messages.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '')
})

test('should call with -d data', async t => {
  t.plan(1)
  const data = [ { message: 'single' } ]
  const args = [
    '-p', './test/protos/reqstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify(data),
    'WriteStuff'
  ]

  const inputFile = path.resolve(__dirname, './data/messages.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '{"message":"single:1","metadata":""}')
})

test('should call with stdin data and -j option', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/reqstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-j', '*.item',
    'WriteStuff'
  ]

  const inputFile = path.resolve(__dirname, './data/messages2.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '{"message":"1 foo:2 bar:3 asd:4 qwe:5 rty:6 zxc:6","metadata":""}')
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
