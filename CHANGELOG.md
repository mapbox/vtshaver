# Changelog

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
