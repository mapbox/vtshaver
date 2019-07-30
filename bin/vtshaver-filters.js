#!/usr/bin/env node

"use strict";

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const styleToFilters = require('../lib/styleToFilters.js');

const usage = `usage:

  vtshaver-filters [args]

    --style:   required: path to a gl style to parse
    --sources: optional: list of one or more sources (comma separated) to display in the output (default is all sources)
    --pretty:  optional: whether to pretty print the output (default false). Pass '--pretty' to indent the JSON.

  Will output a json object describing each of the source-layers and their parsed metadata to be used for shaving.

  Example:

    vtshaver-filters --style style.json > meta.json

`

function error(msg) {
    console.error(usage);
    console.error(msg);
    process.exit(1);
}

if (argv.style == undefined || !fs.existsSync(argv.style)) {
    return error("must supply path to style.json");
}

try {
  const style_json = fs.readFileSync(argv.style);
  const meta = styleToFilters(JSON.parse(style_json));
  let indent = 0;
  if (argv.pretty !== undefined) {
    indent = 4;
  }
  if (argv.sources !== undefined) {
    const sources = argv.sources.split(',');
    var limited_meta = {};
    Object.keys(meta).forEach(function(k) {
      if (sources.includes(k)) {
        limited_meta[k] = meta[k];
      }
    });
    console.log(JSON.stringify(limited_meta,null,indent));
  } else {
    console.log(JSON.stringify(meta,null,indent));
  }

} catch (err) {
  console.error(err.message);
  process.exit(1);
}