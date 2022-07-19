# Changelog

## v0.3.2
- Add missing symbol implementations for `downcase`, `upcase`, and `number-formatter` expressions. The implementation for `number-formatter` is a basic `to_string` and uses no config options. [#58](https://github.com/mapbox/vtshaver/pull/58)

## v0.3.1
- Upgrade node to v16
- Removes cxx11abi flag custom setting as it's the default for compilers building with newer libc++
- Upgrades mbgl-core to 1.6.0-cxx11abi rebuilt with new compiler to remove flag conflict
- Upgrades node-pre-gyp, node-addon-api dependencies
- Upgrades @mapbox/mvt-fixtures, aws-sdk, bytes, d3-queue, pbf dependencies

## v0.3.0
- Support universal binaries by switching to `node-addon-api`
- Binaries are now compiled with clang 10.x
- `AsyncWorker` based implementation

## v0.2.1
- New CLI called `vtshaver-filters` which parses a style, collapses all zoom and filter restrictions per source-layer, and outputs a json object the parsed metadata to be used for shaving.
- Improvements to the `vtshave` CLI: now supporting compressed tiles as input and will output before and after bytes for the original and shaved tile.
- Improvements to code coverage: now tracking both JS and C++ code.

## v0.2.0

- Support key/value filter. (https://github.com/mapbox/vtshaver/issues/15)

## v0.1.3

- Upgrade nan and node-pre-gyp
- Don't depend directory on documentation, since it is so big. Require install directly (npm install -g documentation@4.0.0)

## v0.1.2

* Reduced the package size
* Upgraded to latest @mapbox/mvt-fixtures and @mapbox/mason-js

## v0.1.1

* Fixed support for `zoom` in filter expressions (https://github.com/mapbox/vtshaver/pull/16)

## v0.1.0

* It begins
