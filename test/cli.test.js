"use strict";
var test = require('tape');
var path = require('path');
var fs = require('fs');
var os = require('os');
var cli = path.resolve(__dirname, '..', 'bin', 'vtshave.js');
var spawn = require('child_process').spawn;

var tile = path.join(__dirname, 'fixtures', 'tiles', 'sf_16_10465_25329.vector.pbf');
var style = path.join(__dirname, 'fixtures', 'styles', 'bright-v9.json');


if (process.env.TOOLSET && process.env.TOOLSET === 'asan') {
    test('vtshaver cli works - SKIPPED due to ASAN build', function(t) { t.end() });
} else {
    test('vtshaver cli works', function(t) {
      var args = [cli, '--tile', tile, '--style', style, '--zoom', 16];
      spawn(process.execPath, args)
          .on('error', function(err) { t.ifError(err, 'no error'); })
          .on('close', function(code) {
              t.equal(code, 0, 'exit 0');
              t.end();
          });
    });
}