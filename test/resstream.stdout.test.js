import _ from 'lodash'
import test from 'ava'
import path from 'path'
import async from 'async'
import grpc from 'grpc'
import exec from 'execa'

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

test('should call with stdin data', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    'ListStuff'
  ]

  const input = JSON.stringify({ index: 0 })
  const res = await exec('./gcall.js', args, { input })
  t.is(res.stdout, '{"message":"1 foo","metadata":""},{"message":"2 bar","metadata":""},{"message":"3 asd","metadata":""},{"message":"4 qwe","metadata":""},{"message":"5 rty","metadata":""},{"message":"6 zxc","metadata":""}')
})

test('should call with -d data', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify({ index: 3 }),
    'ListStuff'
  ]

  const res = await exec('./gcall.js', args)
  t.is(res.stdout, '{"message":"4 qwe","metadata":""},{"message":"5 rty","metadata":""},{"message":"6 zxc","metadata":""}')
})

test('should call with -d data and -m metadata', async t => {
  t.plan(1)
  const args = [
    '-p', './test/protos/resstream.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', JSON.stringify({ index: 4 }),
    '-m', JSON.stringify({ requestId: 'abcd' }),
    'ListStuff'
  ]

  const res = await exec('./gcall.js', args)
  t.is(res.stdout, '{"message":"5 rty","metadata":"{\\"requestid\\":\\"abcd\\"}"},{"message":"6 zxc","metadata":"{\\"requestid\\":\\"abcd\\"}"}')
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
