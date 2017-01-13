# gcall

Simple gRPC command line interface

[![npm version](https://img.shields.io/npm/v/gcall.svg?style=flat-square)](https://www.npmjs.com/package/gcall)
[![build status](https://img.shields.io/travis/bojand/gcall/master.svg?style=flat-square)](https://travis-ci.org/bojand/gcall)

## Installation

```
$ npm install -g gcall
```

## Usage

```
Usage: gcall [options] <rpc>

  Options:

    -h, --help                  output usage information
    -V, --version               output the version number
    -p, --proto <file>          Path to protocol buffer definition.
    -h, --host <host>           The service host.
    -d, --data <data>           Input data, otherwise standard input.
    -o, --output <file>         Output path, otherwise standard output.
    -m, --metadata <data>       Metadata value.
    -s, --secure                Use secure options.
    -S, --service <name>        Service name. Default is the 0th found in definition.
    -j, --json [jsonpath]       Input is JSON. JSONPath for parsing. Default: '*'. Set to empty to turn off JSON parsing.
    -b, --breaker [characters]  Separator character(s) for JSON stream response. If flag set, but no separator is defined, default newline is used as separator.
    -a, --array                 Output response stream as an array. Default: false.
    -r, --rpc <name>            RPC to call.
    -c, --config <file>         YAML or JSON config file with all the options.
    -C, --color                 Color output. Useful for terminal output.
    -P, --pretty                Pretty print output.
    -R, --raw                   Raw output. Do not try to JSON stringify or do anything.
    -E, --encoding [encoding]   Encoding for raw mode file output. Default: utf8.
    -X, --silent                Silent. Do not output anything. Just do the call.
```

## Features

* Works with all request types
* Takes input from standard input allowing for piping or from `-d` parameter
* Various output formatting options
* Metadata options
* Config file option

## Examples

### Basic

List all available RPC's in a service

```sh
$ gcall -p ./protos/route_guide.proto
› GetFeature (Point) returns (Feature)
› ListFeatures (Rectangle) returns (stream Feature)
› RecordRoute (stream Point) returns (RouteSummary)
› RouteChat (stream RouteNote) returns (stream RouteNote)
```

### Request / Response

Simple request / response caller

```sh
$ gcall \
-p ./protos/route_guide.proto \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 \
GetFeature
{"name":"Berkshire Valley Management Area Trail, Jefferson, NJ, USA","location":{"latitude":409146138,"longitude":-746188906}}
```

Output data to a file

```sh
$ gcall \
-p ./protos/route_guide.proto \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 \
-o ./feature.json \
GetFeature
```

Input by piping

```sh
cat ./data.json | gcall \
-p ./test/protos/route_guide.proto \
-h 0.0.0.0:50051 \
GetFeature
```

Add metadata using `-m` option

```sh
$ gcall \
-p ./protos/route_guide.proto \
-m "{\"Authorization\": \"Bearer 1234\"}" \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 \
GetFeature
```

Pretty print with `-P` option:

```sh
$ gcall \
-p ./protos/route_guide.proto \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 \
-P \
GetFeature
{
  "name": "Berkshire Valley Management Area Trail, Jefferson, NJ, USA",
  "location": {
    "latitude": 409146138,
    "longitude": -746188906
  }
}
```

Inspect using colors with `-C` option:

```sh
$ gcall \
-p ./protos/route_guide.proto \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 \
-C \
GetFeature
{ name: 'Berkshire Valley Management Area Trail, Jefferson, NJ, USA',
 location: { latitude: 409146138, longitude: -746188906 } }
```

Run using a config file (we can do JSON or YAML).
Note that you can combine config file and command line options.
Command line options will overwrite any existing config file options.

**config.json**

```json
{
  "proto": "/protos/route_guide.proto",
  "data": {
    "latitude": 409146138,
    "longitude": -746188906
  },
  "host": "0.0.0.0:50051",
  "pretty": true,
  "rpc": "GetFeature"
}
```

```sh
$ gcall -c config.json
{
  "name": "Berkshire Valley Management Area Trail, Jefferson, NJ, USA",
  "location": {
    "latitude": 409146138,
    "longitude": -746188906
  }
}
```

### Request stream

`-j` flag can be used to specify [JSONPath](http://goessner.net/articles/JsonPath/)
for JSON parsing. Default is `'*'` and normally it wouldn't be needed, depending on the
input data structure.

Input redirection can be used for input as well.

```sh
$ gcall.js \
-p ./protos/route_guide.proto \
-h 0.0.0.0:50051 \
-j *.location \
RecordRoute < ./test/feature_guide_db.json
{"point_count":100,"feature_count":64,"distance":7494392,"elapsed_time":0}
```

We can pipe

```sh
curl -s https://raw.githubusercontent.com/bojand/gcall/master/test/data/feature_guide_db.json | gcall.js \
-p ./test/protos/route_guide.proto \
-h 0.0.0.0:50051 \
-j *.location \
-P \
RecordRoute
{
  "point_count": 100,
  "feature_count": 64,
  "distance": 7494392,
  "elapsed_time": 4
}
```

### Response stream

```sh
$ gcall.js \
-p ./test/protos/route_guide.proto \
-d "{\"lo\":{\"latitude\":400000000,\"longitude\":-750000000},\"hi\":{\"latitude\":405000000,\"longitude\":-742000000}}" \
-h 0.0.0.0:50051 \
ListFeatures
{"name":"3 Drake Lane, Pennington, NJ 08534, USA","location":{"latitude":402948455,"longitude":-747903913}},{"name":"330 Evelyn Avenue, Hamilton Township, NJ 08619, USA","location":{"latitude":402647019,"longitude":-747071791}},{"name":"1300 Airport Road, North Brunswick Township, NJ 08902, USA","location":{"latitude":404663628,"longitude":-744820157}},{"name":"1007 Jersey Avenue, New Brunswick, NJ 08901, USA","location":{"latitude":404701380,"longitude":-744781745}},{"name":"517-521 Huntington Drive, Manchester Township, NJ 08759, USA","location":{"latitude":400106455,"longitude":-742870190}},{"name":"1-17 Bergen Court, New Brunswick, NJ 08901, USA","location":{"latitude":404839914,"longitude":-744759616}}
```

We can pretty print as an array using `-a` and `-P` options:

```sh
$ gcall.js \
-p ./test/protos/route_guide.proto \
-d "{\"lo\":{\"latitude\":400000000,\"longitude\":-750000000},\"hi\":{\"latitude\":405000000,\"longitude\":-742000000}}" \
-h 0.0.0.0:50051 \
-a \
-P \
ListFeatures
[
  {
    "name": "3 Drake Lane, Pennington, NJ 08534, USA",
    "location": {
      "latitude": 402948455,
      "longitude": -747903913
    }
  },
  {
    "name": "330 Evelyn Avenue, Hamilton Township, NJ 08619, USA",
    "location": {
      "latitude": 402647019,
      "longitude": -747071791
    }
  },
  {
    "name": "1300 Airport Road, North Brunswick Township, NJ 08902, USA",
    "location": {
      "latitude": 404663628,
      "longitude": -744820157
    }
  },
  {
    "name": "1007 Jersey Avenue, New Brunswick, NJ 08901, USA",
    "location": {
      "latitude": 404701380,
      "longitude": -744781745
    }
  },
  {
    "name": "517-521 Huntington Drive, Manchester Township, NJ 08759, USA",
    "location": {
      "latitude": 400106455,
      "longitude": -742870190
    }
  },
  {
    "name": "1-17 Bergen Court, New Brunswick, NJ 08901, USA",
    "location": {
      "latitude": 404839914,
      "longitude": -744759616
    }
  }
]
```

Or we can do a custom separator using `-b`. If separator is not provided, newline
is used by default

```sh
$ gcall.js \
-p ./test/protos/route_guide.proto \
-d "{\"lo\":{\"latitude\":400000000,\"longitude\":-750000000},\"hi\":{\"latitude\":405000000,\"longitude\":-742000000}}" \
-b \
-h 0.0.0.0:50051 \
ListFeatures
{"name":"3 Drake Lane, Pennington, NJ 08534, USA","location":{"latitude":402948455,"longitude":-747903913}}
{"name":"330 Evelyn Avenue, Hamilton Township, NJ 08619, USA","location":{"latitude":402647019,"longitude":-747071791}}
{"name":"1300 Airport Road, North Brunswick Township, NJ 08902, USA","location":{"latitude":404663628,"longitude":-744820157}}
{"name":"1007 Jersey Avenue, New Brunswick, NJ 08901, USA","location":{"latitude":404701380,"longitude":-744781745}}
{"name":"517-521 Huntington Drive, Manchester Township, NJ 08759, USA","location":{"latitude":400106455,"longitude":-742870190}}
{"name":"1-17 Bergen Court, New Brunswick, NJ 08901, USA","location":{"latitude":404839914,"longitude":-744759616}}
```

Or with combination of `-b` and `-a`

```sh
$ gcall.js \
-p ./test/protos/route_guide.proto \
-d "{\"lo\":{\"latitude\":400000000,\"longitude\":-750000000},\"hi\":{\"latitude\":405000000,\"longitude\":-742000000}}" \
-b \
-a \
-h 0.0.0.0:50051 \
ListFeatures
{"name":"3 Drake Lane, Pennington, NJ 08534, USA","location":{"latitude":402948455,"longitude":-747903913}}
,
{"name":"330 Evelyn Avenue, Hamilton Township, NJ 08619, USA","location":{"latitude":402647019,"longitude":-747071791}}
,
{"name":"1300 Airport Road, North Brunswick Township, NJ 08902, USA","location":{"latitude":404663628,"longitude":-744820157}}
,
{"name":"1007 Jersey Avenue, New Brunswick, NJ 08901, USA","location":{"latitude":404701380,"longitude":-744781745}}
,
{"name":"517-521 Huntington Drive, Manchester Township, NJ 08759, USA","location":{"latitude":400106455,"longitude":-742870190}}
,
{"name":"1-17 Bergen Court, New Brunswick, NJ 08901, USA","location":{"latitude":404839914,"longitude":-744759616}}]
```

Or just a custom separator

```sh
$ gcall.js \
-p ./test/protos/route_guide.proto \
-d "{\"lo\":{\"latitude\":400000000,\"longitude\":-750000000},\"hi\":{\"latitude\":405000000,\"longitude\":-742000000}}" \
-b " | " \
-h 0.0.0.0:50051 \
ListFeatures
{"name":"3 Drake Lane, Pennington, NJ 08534, USA","location":{"latitude":402948455,"longitude":-747903913}} | {"name":"330 Evelyn Avenue, Hamilton Township, NJ 08619, USA","location":{"latitude":402647019,"longitude":-747071791}} | {"name":"1300 Airport Road, North Brunswick Township, NJ 08902, USA","location":{"latitude":404663628,"longitude":-744820157}} | {"name":"1007 Jersey Avenue, New Brunswick, NJ 08901, USA","location":{"latitude":404701380,"longitude":-744781745}} | {"name":"517-521 Huntington Drive, Manchester Township, NJ 08759, USA","location":{"latitude":400106455,"longitude":-742870190}} | {"name":"1-17 Bergen Court, New Brunswick, NJ 08901, USA","location":{"latitude":404839914,"longitude":-744759616}}
```
