import test from 'ava'
import exec from 'execa'
import os from 'os'

test('should list service calls', async t => {
  t.plan(4)
  const res = await exec('./gcall.js', ['-p', './test/protos/route_guide.proto'])
  const lines = res.stdout.split(os.EOL)
  t.true(lines[0].indexOf('GetFeature (Point) returns (Feature)') >= 0)
  t.true(lines[1].indexOf('ListFeatures (Rectangle) returns (stream Feature)') >= 0)
  t.true(lines[2].indexOf('RecordRoute (stream Point) returns (RouteSummary)') >= 0)
  t.true(lines[3].indexOf('RouteChat (stream RouteNote) returns (stream RouteNote)') >= 0)
})

test('should list service calls with proto and host but without a method', async t => {
  t.plan(4)
  const args = [
    '-p', './test/protos/route_guide.proto',
    '-h', 'localhost:50051'
  ]
  const res = await exec('./gcall.js', args)
  const lines = res.stdout.split(os.EOL)
  t.true(lines[0].indexOf('GetFeature (Point) returns (Feature)') >= 0)
  t.true(lines[1].indexOf('ListFeatures (Rectangle) returns (stream Feature)') >= 0)
  t.true(lines[2].indexOf('RecordRoute (stream Point) returns (RouteSummary)') >= 0)
  t.true(lines[3].indexOf('RouteChat (stream RouteNote) returns (stream RouteNote)') >= 0)
})

test('should error with an unknown service', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/route_guide.proto',
    '-S', 'FakeService'
  ]
  const res = await t.throws(exec('./gcall.js', args))
  t.true(res.stderr.indexOf('Service \'FakeService\' does not exist in protocol buffer definition.') >= 0)
})

test('should error with an unknown method', async t => {
  t.plan(2)
  const args = [
    '-p', './test/protos/route_guide.proto',
    '-h', 'localhost:50051',
    'FakeMethod'
  ]
  const res = await t.throws(exec('./gcall.js', args))
  t.true(res.stderr.indexOf('RPC method \'FakeMethod\' does not exist for service RouteGuide.') >= 0)
})
