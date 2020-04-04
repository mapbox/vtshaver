# Vector Tile Shaver

*Style-optimized vector tiles.* The shaver takes a **Mapbox Vector Tile** and a **Mapbox GL Style** and removes layers, features, and properties in the tile that are not used by the style to reduce the size of the tile. Read the feature release [blog post](https://www.mapbox.com/blog/style-optimized-vector-tiles/) and the [api-documentation](https://www.mapbox.com/api-documentation/#retrieve-tiles) for more info.

[![Build Status](https://travis-ci.com/mapbox/vtshaver.svg?branch=master)](https://travis-ci.com/mapbox/vtshaver)
[![codecov](https://codecov.io/gh/mapbox/vtshaver/branch/master/graph/badge.svg)](https://codecov.io/gh/mapbox/vtshaver)
[![badge](https://mapbox.s3.amazonaws.com/cpp-assets/node-cpp-skel-badge_blue.svg)](https://github.com/mapbox/node-cpp-skel)

![shaved-bearded tile and unshaved-bearded tile](https://user-images.githubusercontent.com/1943001/37542004-e49656b6-2919-11e8-9635-db1b47fcd0fa.jpg)

# Installation

```bash
npm install @mapbox/vtshaver
```

If you want to install locally you can also do:

```bash
git clone https://github.com/mapbox/vtshaver
cd vtshaver
npm install
```

# API Usage

* [styleToFilters](API-JavaScript.md#styletofilters)
* [Filters](API-CPP.md#filters)
* [shave](API-CPP.md#shave)

# CLI

Shaver provides 2 command line tools:

## vtshave

```
vtshave [args]

  --tile:    required: path to the input vector tile
  --style:   required: path to a gl style to use to shave
  --zoom:    required: the zoom level
  --maxzoom: optional: the maxzoom of a tileset relevant to the tile buffer being shaved
  --out:     optional: pass a path if you want the shaved tile to be saved

Will output a size comparison of how many bytes were shaved off the tile.

Example:

  vtshave --tile tile.mvt --zoom 0 --maxzoom 16 --style style.json
```

## vtshaver-filters

```
vtshaver-filters [args]

  --style:   required: path to a gl style to parse
  --sources: optional: list of one or more sources (comma separated) to display in the output (default is all sources)
  --pretty:  optional: whether to pretty print the output (default false). Pass '--pretty' to indent the JSON.

Will output a json object describing each of the source-layers and their parsed metadata to be used for shaving.

Example:

  vtshaver-filters --style style.json > meta.json
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
