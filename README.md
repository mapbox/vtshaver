# Vector Tile Shaver

*Style-optimized vector tiles.* The shaver takes a **Mapbox Vector Tile** and a **Mapbox GL Style** and removes layers in the tile that are not used by the style to reduce the size of the tile. Read the feature release [blog post](https://www.mapbox.com/blog/style-optimized-vector-tiles/) and the [api-documentation](https://www.mapbox.com/api-documentation/#retrieve-tiles) for more info.

[![Build Status](https://travis-ci.com/mapbox/vtshaver.svg?branch=master)](https://travis-ci.com/mapbox/vtshaver)
[![codecov](https://codecov.io/gh/mapbox/vtshaver/branch/master/graph/badge.svg)](https://codecov.io/gh/mapbox/vtshaver)
[![badge](https://mapbox.s3.amazonaws.com/cpp-assets/node-cpp-skel-badge_blue.svg)](https://github.com/mapbox/node-cpp-skel)

![shaved-bearded tile and unshaved-bearded tile](https://user-images.githubusercontent.com/1943001/37542004-e49656b6-2919-11e8-9635-db1b47fcd0fa.jpg)

# Installation

```bash
npm install @mapbox/vtshaver
```

# Usage

### `require`

```javascript
var shaver = require('@mapbox/vtshaver');
```

### `styleToFilters(style)`

Takes a Mapbox GL Style JSON and returns an optimized filter object for use within the shaver.
- Layers that are styled using filters, the filters are stored in an array.
- Layers that are styled but dont contain filters will return `true`.

```javascript
var style = require('/path/to/style.json');
var filters = shaver.styleToFilters(style);
console.log(filters);
// {
//   "poi_label": ["!=","maki","cafe"],
//   "road": ["==","class","path"],
//   "water": true,
//   ...
// }
```

### `shave(tile, options, callback)`

Takes a Mapbox Vector Tile `.mvt` buffer and compares it to a Mapbox GL Style-based filter object to remove unused layers and features. You can create a filter object with the `shave.styleToFilters()` method.

```javascript
var fs = require('fs');

var buffer = fs.readFileSync('/path/to/vector-tile.mvt');
var style = require('/path/to/style.json');
var filters = shaver.styleToFilters(style);

var options = {
    filters: filters,  // required
    zoom: 14,          // required
    maxzoom: 16,       // optional
    compress: {        // optional
      type: 'none'
    }
};

shaver.shave(buffer, options, function(err, shavedTile) {
  if (err) throw err;
  console.log(shavedTile); // => vector tile buffer
});
```

Optionally set compression option if you'd like shaver to output a compressed shaved tile.
```javascript
var fs = require('fs');

var buffer = fs.readFileSync('/path/to/vector-tile.mvt');
var style = require('/path/to/style.json');
var filters = shaver.styleToFilters(style);

var options = {
    filters: filters,  // required
    zoom: 14,          // required
    maxzoom: 16,       // optional
    compress: {        // optional
      type: 'gzip'
    }
};

shaver.shave(buffer, options, function(err, shavedTile) {
  if (err) throw err;
  console.log(shavedTile); // => gzip compressed vector tile buffer
});
```

# CLI
```
vtshave [args]

  vtshave requires these options:

    --tile:  required: path to the input vector tile
    --style: required: path to a gl style to use to shave
    --zoom:  required: the zoom level
    --maxzoom: optional: the maxzoom of a tileset relevant to the tile buffer being shaved
    --out:   optional: pass a path if you want the shaved tile to be saved

  Will output a summary of layers names with the feature count before and after shaving.

  Example:

    vtshave --tile tile.mvt --zoom 0 --maxzoom 16 --style style.json --out shaved.mvt
```

# Develop

Setup fixtures for bench test

```
git submodule update --init
```

Build binaries

```
make
```

# Test

```
make test
```

Run bench test

```
time node bench/bench-batch.js --iterations 50 --concurrency 10
```

Optionally combine with the `time` command

# Docs

Documentation is generated using Documentation.js `--polyglot` mode. Generate docs in `API.md` by running:

```
make docs
```

NOTE: we are pinned to `documentation@4.0.0` because 5.x removed C++ support: https://github.com/documentationjs/documentation/blob/master/CHANGELOG.md#500-2017-07-27
