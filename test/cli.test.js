"use strict";
var test = require('tape');
var path = require('path');
var fs = require('fs');
var os = require('os');
var spawn = require('child_process').spawn;

var vtshave_cli = path.resolve(__dirname, '..', 'bin', 'vtshave.js');
var vtshaver_filters_cli = path.resolve(__dirname, '..', 'bin', 'vtshaver-filters.js');
var tile = path.join(__dirname, 'fixtures', 'tiles', 'sf_16_10465_25329.vector.pbf');
var style = path.join(__dirname, 'fixtures', 'styles', 'bright-v9.json');

if (process.env.TOOLSET && process.env.TOOLSET === 'asan') {
    test('vtshave cli works - SKIPPED due to ASAN build', function(t) { t.end() });
} else {
    test('vtshave cli works', function(t) {
      var args = [vtshave_cli, '--tile', tile, '--style', style, '--zoom', 16];
      spawn(process.execPath, args)
          .on('error', function(err) { t.ifError(err, 'no error'); })
          .on('close', function(code) {
              t.equal(code, 0, 'exit 0');
              t.end();
          });
    });

    test('vtshaver-filters cli works', function(t) {
      var args = [vtshaver_filters_cli, '--style', style];
      spawn(process.execPath, args)
          .on('error', function(err) { t.ifError(err, 'no error'); })
          .on('close', function(code) {
              t.equal(code, 0, 'exit 0');
              t.end();
          });
    });

    test('vtshaver-filters cli works with --pretty and --sources', function(t) {
      var args = [vtshaver_filters_cli, '--style', style, '--pretty', '--sources', 'landuse_overlay,landuse'];
      spawn(process.execPath, args)
          .on('error', function(err) { t.ifError(err, 'no error'); })
          .on('close', function(code) {
              t.equal(code, 0, 'exit 0');
              t.end();
          })
          .stdout.on('data', function(data) {
            t.deepEqual(Object.keys(JSON.parse(data.toString())),[ 'landuse_overlay', 'landuse' ]);
          })
    });

    test('vtshaver-filters cli errors on invalid style arg', function(t) {
      var args = [vtshaver_filters_cli];
      spawn(process.execPath, args)
         .on('error', function(err) { t.ifError(err, 'no error'); })
          .on('close', function(code) {
              t.equal(code, 1, 'exit 1');
              t.end();
          });
    });

    test('vtshaver-filters cli errors on invalid style that cannot be parsed', function(t) {
      var args = [vtshaver_filters_cli, '--style', __dirname];
      spawn(process.execPath, args)
         .on('error', function(err) { t.ifError(err, 'no error'); })
          .on('close', function(code) {
              t.equal(code, 1, 'exit 1');
              t.end();
          });
    });

}

