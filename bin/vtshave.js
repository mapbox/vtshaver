#!/usr/bin/env node

"use strict";

var fs = require('fs');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));
var shaver = require('../');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var zlib = require('zlib');
var bytes = require('bytes');

var usage = `usage:

  vtshave [args]

    --tile:    required: path to the input vector tile
    --style:   required: path to a gl style to use to shave
    --zoom:    required: the zoom level
    --maxzoom: optional: the maxzoom of a tileset relevant to the tile buffer being shaved
    --out:     optional: pass a path if you want the shaved tile to be saved

  Will output a size comparison of how many bytes were shaved off the tile.

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
      console.log('Before (gzip):\n',bytes(buffer.length));
      console.log('After (gzip):\n',bytes(shavedBuffer.length));
      console.log('Savings (gzip):\n',(shavedBuffer.length/buffer.length*100).toFixed(2)+'%');
      const og_decompressed = zlib.gunzipSync(buffer);
      const shaved_decompressed = zlib.gunzipSync(shavedBuffer);
      console.log('Before (raw):\n',bytes(og_decompressed.length));
      console.log('After (raw):\n',bytes(shaved_decompressed.length));
      console.log('Savings (raw):\n',(shaved_decompressed.length/og_decompressed.length*100).toFixed(2)+'%');
    } else {
      const og_compressed = zlib.gzipSync(buffer);
      const shaved_compressed = zlib.gzipSync(shavedBuffer);
      console.log('Before (gzip):\n',bytes(og_compressed.length));
      console.log('After (gzip):\n',bytes(shaved_compressed.length));
      console.log('Savings (gzip):\n',(shaved_compressed.length/og_compressed.length*100).toFixed(2)+'%');
      console.log('Before (raw):\n',bytes(buffer.length));
      console.log('After (raw):\n',bytes(shavedBuffer.length));
      console.log('Savings (raw):\n',(shavedBuffer.length/buffer.length*100).toFixed(2)+'%');
    }

    if (argv.out != undefined) {
        fs.writeFileSync(argv.out,shavedBuffer);
        console.log('Wrote shaved tile to ' + argv.out);
    }
})
