#!/usr/bin/env node

"use strict";

var fs = require('fs');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));
var shaver = require('../');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var zlib = require('zlib');

var usage = `usage:

  vtshave [args]

    --tile:    required: path to the input vector tile
    --style:   required: path to a gl style to use to shave
    --zoom:    required: the zoom level
    --maxzoom: optional: the maxzoom of a tileset relevant to the tile buffer being shaved
    --out:     optional: pass a path if you want the shaved tile to be saved

  Will output a summary of layers names with the feature count before and after shaving.

  Example:

    vtshave --tile tile.mvt --zoom 0 --maxzoom 16 --style style.json

`

function error(msg) {
    console.error(usage);
    console.error(msg);
    process.exit(1);
}

if (argv.tile == undefined || !fs.existsSync(argv.tile) ) {
    return error("please provide the path to a tile.mvt");
}

if (argv.style== undefined || !fs.existsSync(argv.style)) {
    return error("must supply path to filters.json")    
}

if (argv.zoom == undefined) {
    return error("please provide the zoom of the tile being shaved");
}

function vtinfo(buffer) {
  var tile = new vt(new pbf(buffer));
  var info = {
    layers : []
  };
  Object.keys(tile.layers).forEach(function(k) {
    var lay = tile.layers[k];
    info.layers.push({
      name:k,
      features:lay.length
    })
  });
  return info;
}

var buffer = fs.readFileSync(argv.tile);
var style_json = fs.readFileSync(argv.style);

try {
  var filters = new shaver.Filters(shaver.styleToFilters(JSON.parse(style_json)));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

var is_compressed = (buffer[0] === 0x1F && buffer[1] === 0x8B);
var opts = {
  filters: filters,
  zoom: argv.zoom
};

if (is_compressed) {
  opts.compress = {type: "gzip"};
}

if (argv.maxzoom) opts.maxzoom = argv.maxzoom;

shaver.shave(buffer, opts, function(err, shavedBuffer) {
    if (err) throw err.message;

    if (is_compressed) {
      var decompressed_og = zlib.gunzipSync(buffer);
      console.log('Before:\n',JSON.stringify(vtinfo(decompressed_og),null,1));
      var decompressed_res =   zlib.gunzipSync(shavedBuffer);
      console.log('Before:\n',JSON.stringify(vtinfo(decompressed_res),null,1));
    } else {
      console.log('Before:\n',JSON.stringify(vtinfo(buffer),null,1));
      console.log('After:\n',JSON.stringify(vtinfo(shavedBuffer),null,1));
    }

    if (argv.out != undefined) {
        fs.writeFileSync(argv.out,shavedBuffer);
        console.log('Wrote shaved tile to ' + argv.out);
    }
})
