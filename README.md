# gcall

Simple gRPC command line interface

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
$ gcall -p ./test/protos/route_guide.proto
› GetFeature (Point) returns (Feature)
› ListFeatures (Rectangle) returns (stream Feature)
› RecordRoute (stream Point) returns (RouteSummary)
› RouteChat (stream RouteNote) returns (stream RouteNote)
```

### Request / Response

Simple request / response caller

```sh
$ gcall \
-p ./test/protos/route_guide.proto \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 \
GetFeature
{"name":"Berkshire Valley Management Area Trail, Jefferson, NJ, USA","location":{"latitude":409146138,"longitude":-746188906}}
```

Output data to a file

```sh
$ gcall \
-p ./test/protos/route_guide.proto \
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
-p ./test/protos/route_guide.proto \
-m "{\"Authorization\": \"Bearer 1234\"}" \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 \
GetFeature
```

Pretty print with `-P` option:

```sh
$ gcall \
-p ./test/protos/route_guide.proto \
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
-p ./test/protos/route_guide.proto \
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
  "proto": "/test/protos/route_guide.proto",
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
