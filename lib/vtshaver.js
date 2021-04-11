"use strict";

var binary = require('@mapbox/node-pre-gyp');
var exists = require('fs').existsSync || require('path').existsSync;
var path = require('path');
var binding_path = binary.find(path.resolve(path.join(__dirname,'../package.json')));
var styleToFilters = require(__dirname + '/styleToFilters.js');

var VTSHAVER = module.exports = require(binding_path);
VTSHAVER.styleToFilters = styleToFilters;
VTSHAVER.version = require('../package.json').version;
