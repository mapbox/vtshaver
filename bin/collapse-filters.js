#!/usr/bin/env node

"use strict";

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const styleToFilters = require('../lib/styleToFilters.js');

const usage = `usage:

  collapse-filters [args]

    --style:   required: path to a gl style to parse
    --pretty:  optional: whether to pretty print the output (default True)

  Will output a a json object describing the layers and parsed metadata to be used for shaving.

  Example:

    collapse-filters --style style.json > meta.json

`

function error(msg) {
    console.error(usage);
    console.error(msg);
    process.exit(1);
}


if (argv.style == undefined || !fs.existsSync(argv.style)) {
    return error("must supply path to style.json");
}

const style_json = fs.readFileSync(argv.style);

try {
  const meta = styleToFilters(JSON.parse(style_json));
  if (argv.pretty !== undefined && !argv.pretty) {
    console.log(JSON.stringify(meta));    
  } else {
    console.log(JSON.stringify(meta,null,4));    
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}