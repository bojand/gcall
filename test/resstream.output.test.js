import _ from 'lodash'
import fs from 'fs'
import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc'
import pify from 'pify'
import exec from 'execa'

const readFile = pify(fs.readFile)

const PROTO_PATH = path.resolve(__dirname, './protos/resstream.proto')
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

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getHost (port) {
  return '0.0.0.0:'.concat(port || getRandomInt(1000, 60000))
}

const OUTPUT_FILE = path.resolve(__dirname, './output/resstream.txt')
const DYNAMIC_HOST = getHost()

test.before('should dynamically create service', t => {
  function listStuff (call) {
    const index = call.request.index
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

    async.eachOfSeries(data, (d, i, asfn) => {
      if (i >= index) {
        const ret = { message: d.message }
        if (meta) {
          ret.metadata = meta
        }
        call.write(ret)
      }
      _.delay(asfn, _.random(50, 150))
    }, () => {
      call.end()
    })
  }

  const server = new grpc.Server()
  server.addProtoService(argProto.ArgService.service, { listStuff })
  server.bind(DYNAMIC_HOST, grpc.ServerCredentials.createInsecure())
  server.start()
  apps.push(server)
})

test.beforeEach('truncate', t => {
  fs.truncateSync(OUTPUT_FILE)
})

test.serial('should call with stdin data', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    'ListStuff'
  ]

  const input = JSON.stringify({ index: 0 })
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  t.is(actual, '{"message":"1 foo","metadata":""},{"message":"2 bar","metadata":""},{"message":"3 asd","metadata":""},{"message":"4 qwe","metadata":""},{"message":"5 rty","metadata":""},{"message":"6 zxc","metadata":""}')
})

test.serial('should call with stdin data and -P pretty', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    '-P',
    'ListStuff'
  ]

  const input = JSON.stringify({ index: 0 })
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = await readFile(path.resolve(__dirname, './expected/resstream1.txt'), 'utf8')
  t.is(actual, expected)
})

test.serial('should call with stdin data and -P and -b', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    '-P',
    '-b', ' | ',
    'ListStuff'
  ]

  const input = JSON.stringify({ index: 0 })
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = await readFile(path.resolve(__dirname, './expected/resstream2.txt'), 'utf8')
  t.is(actual, expected)
})

test.serial('should call with stdin data and -P and -b', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    '-b', ' | ',
    'ListStuff'
  ]

  const input = JSON.stringify({ index: 0 })
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = await readFile(path.resolve(__dirname, './expected/resstream3.txt'), 'utf8')
  t.is(actual, expected)
})

test.serial('should call with stdin data and -a', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    '-a',
    'ListStuff'
  ]

  const input = JSON.stringify({ index: 0 })
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  t.is(actual, '[{"message":"1 foo","metadata":""},{"message":"2 bar","metadata":""},{"message":"3 asd","metadata":""},{"message":"4 qwe","metadata":""},{"message":"5 rty","metadata":""},{"message":"6 zxc","metadata":""}]')
})

test.serial('should call with stdin data and -a and -P', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-o', OUTPUT_FILE,
    '-a',
    '-P',
    'ListStuff'
  ]

  const input = JSON.stringify({ index: 0 })
  const res = await exec('./gcall.js', args, { input })
  t.is(res.code, 0)

  const actual = await readFile(OUTPUT_FILE, 'utf8')
  const expected = await readFile(path.resolve(__dirname, './expected/resstream4.txt'), 'utf8')
  t.is(actual, expected)
})

test.after.always.cb('guaranteed cleanup', t => {
  fs.truncateSync(OUTPUT_FILE)
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
