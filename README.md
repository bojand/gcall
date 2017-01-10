# gcall

Simple gRPC command line interface

## Installation

```
$ npm install -g gcall
```

## Usage

```sh
Usage: gcall [options] <method>

  Options:

    -h, --help                      output usage information
    -V, --version                   output the version number
    -p, --proto <file>              Path to protocol buffer definition.
    -S, --service <name>            Service name. Default is the 0th found in definition.
    -h, --host <host>               The service host.
    -d, --data <data>               Input data, otherwise standard input.
    -s, --secure                    Use secure options.
    -o, --output <file>             Output path, otherwise standard output.
    -j, --json <jsonpath>           JSONPath for request stream parsing. Default: '*'.
    -a, --array                     Output response stream as an array. Default: false. Outputs data separated by newlines.
    -m, --metadata <metadata data>  Metadata value.
```

## Examples

List methods in a service

```sh
$ gcall -p ./test/protos/route_guide.proto
› GetFeature (Point) returns (Feature)
› ListFeatures (Rectangle) returns (stream Feature)
› RecordRoute (stream Point) returns (RouteSummary)
› RouteChat (stream RouteNote) returns (stream RouteNote)
```

Simple request / response caller

```sh
$ gcall \
-p ./test/protos/route_guide.proto \
-d "{\"latitude\":409146138,\"longitude\":-746188906}" \
-h 0.0.0.0:50051 GetFeature
{ name: 'Berkshire Valley Management Area Trail, Jefferson, NJ, USA',
  location: { latitude: 409146138, longitude: -746188906 } }
```
