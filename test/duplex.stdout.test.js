import _ from 'lodash'
import fs from 'fs'
import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc'
import exec from 'execa'

const PROTO_PATH = path.resolve(__dirname, './protos/duplex.proto')
const argProto = grpc.load(PROTO_PATH).argservice

const apps = []

const data = [
  { message: '1 foo' },
  { message: '2 bar' },
  { message: '3 asd' },
  { message: '4 qwe' },
  { message: '5 rty' },
  { message: '6 zxc' }
]

const data2 = [
  { d: { message: '1 foo' } },
  { d: { message: '2 bar' } },
  { d: { message: '3 asd' } },
  { d: { message: '4 qwe' } },
  { d: { message: '5 rty' } },
  { d: { message: '6 zxc' } }
]

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const DYNAMIC_HOST = getHost()

test.before('should dynamically create service', t => {
  function processStuff (call) {
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

    call.on('data', d => {
      call.pause()
      _.delay(() => {
        const ret = { message: d.message.toUpperCase() }
        if (meta) {
          ret.metadata = meta
        }
        call.write(ret)
        call.resume()
      }, _.random(50, 150))
    })

    call.on('end', () => {
      _.delay(() => {
        call.end()
      }, 200)
    })
  }

  const server = new grpc.Server()
  server.addProtoService(argProto.ArgService.service, { processStuff })
  server.bind(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure())
  server.start()
  apps.push(server)
})

test('should call with stdin data', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/duplex.proto',
    '-h', DYNAMIC_HOST.toString(),
    'ProcessStuff'
  ]

  const input = JSON.stringify(data)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '{"message":"1 FOO","metadata":""},{"message":"2 BAR","metadata":""},{"message":"3 ASD","metadata":""},{"message":"4 QWE","metadata":""},{"message":"5 RTY","metadata":""},{"message":"6 ZXC","metadata":""}')
})

test('should call with stdin data and -j option', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/duplex.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-j', '*.d',
    'ProcessStuff'
  ]

  const input = JSON.stringify(data2)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '{"message":"1 FOO","metadata":""},{"message":"2 BAR","metadata":""},{"message":"3 ASD","metadata":""},{"message":"4 QWE","metadata":""},{"message":"5 RTY","metadata":""},{"message":"6 ZXC","metadata":""}')
})

test('should call with stdin file data', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/duplex.proto',
    '-h', DYNAMIC_HOST.toString(),
    'ProcessStuff'
  ]

  const inputFile = path.resolve(__dirname, './data/messages.json')
  const input = fs.createReadStream(inputFile)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '{"message":"1 FOO","metadata":""},{"message":"2 BAR","metadata":""},{"message":"3 ASD","metadata":""},{"message":"4 QWE","metadata":""},{"message":"5 RTY","metadata":""},{"message":"6 ZXC","metadata":""}')
})

test('should call with stdin data and not output anything with -X option', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/duplex.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-X',
    'ProcessStuff'
  ]

  const input = JSON.stringify(data)
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)
  t.is(res.stdout, '')
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
