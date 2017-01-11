import _ from 'lodash'
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

test('should call with -d data', async t => {
  t.plan(2)
  const data = { message: 'Hello' }
  const str = JSON.stringify(data)
  const args = [
    '-p', './test/protos/reqres.proto',
    '-h', DYNAMIC_HOST.toString(),
    '-d', str,
    'DoSomething'
  ]
  const res = await exec('./gcall.js', args)
  const i = res.stdout.indexOf('message: ')
  t.true(i >= 0)
  t.true(res.stdout.indexOf('\'Hello\'') > i)
})

test.after.always.cb('guaranteed cleanup', t => {
  async.each(apps, (app, ascb) => app.tryShutdown(ascb), t.end)
})
