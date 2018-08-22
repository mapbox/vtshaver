"use strict";

var binary = require('node-pre-gyp');
var exists = require('fs').existsSync || require('path').existsSync;
var path = require('path');
var binding_path = binary.find(path.resolve(path.join(__dirname,'../package.json')));
var styleToFilters = require(__dirname + '/styleToFilters.js');

var VT_SHAVER = module.exports = require(binding_path);
VT_SHAVER.styleToFilters = styleToFilters;
VT_SHAVER.version = require('../package.json').version;