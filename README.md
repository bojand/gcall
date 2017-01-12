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
    -X, --silent                Silent. Do not output anything. Just do the call.
```

## Features

* Works with all request types
* Takes input from standard input allowing for piping or from `-d` parameter
* Various output formatting options

## Examples

### Basic

List methods in a service

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
-o feature.json \
GetFeature
```

Input by piping

```sh
cat ./data.json | gcall \
-p ./test/protos/route_guide.proto \
-h 0.0.0.0:50051 \
GetFeature
```
