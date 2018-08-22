"use strict";

var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));
var s = require('../lib/index.js');
var path = require('path');
var assert = require('assert');
var bytes = require('bytes');

if (!argv.iterations || !argv.concurrency) {
  console.error('Please provide desired iterations and concurrency');
  console.error('Example: \n\tnode bench/bench-batch.js --iterations 50 --concurrency 10');
  console.error('Optional args: \n\t--mem (reports memory stats)');
  process.exit(1);
}

if (!argv.iterations || !argv.concurrency) {
  process.stdout.write('Please provide desired iterations and concurrency');
  process.exit(1);
}

if (argv.compress) {
  if (argv.compress != 'gzip') {
    console.error("Whoops! We currently only support gzip compression. Falling back to using gzip.");
  }
  argv.compress = 'gzip';
} else {
  argv.compress = 'none';
}

if (process.env.NPM_FLAGS === '--debug' || process.env.COVERAGE === true) {
  console.log('# SKIP benchmark: tests are in debug or coverage mode');
  process.exit(0);
}

process.env.UV_THREADPOOL_SIZE = argv.concurrency;

var p = "node_modules/@mapbox/mvt-fixtures/real-world/chicago/";

// Get chicago tiles from real-world fixtures
fs.readdir(p, function (err, files) {
    if (err) throw err;
    start(files);
});

var start = function(files){
    var track_mem = argv.mem ? true : false;
    var style = require('../test/fixtures/styles/expressions.json');
    var filters = new s.Filters(s.styleToFilters(style));
    var options = {
      zoom: 13,
      filters: filters,
      compress: {
        type: argv.compress
      }
    };
    var d3_queue = require('d3-queue');
    var iterations = argv.iterations;
    var concurrency = argv.concurrency;
    // @springmeyer noticed a > 120 ops/s benefit to not passing a fixed queue size on OS X
    var queue = d3_queue.queue();
    var runs = 0;
    var memstats = {
      max_rss:0,
      max_heap:0,
      max_heap_total:0
    };
    var tiles = [];

    files.forEach(function(file) {
      var path = p+file;
      var buffer = fs.readFileSync(path);

      tiles.push(buffer);
    });

    function run(tile, cb) {
      s.shave(tile, options, function(err, shavedTile) {
        if (err) {
          return cb(err);
        }
        ++runs;
        if (track_mem && runs % 1000) {
            var mem = process.memoryUsage();
            if (mem.rss > memstats.max_rss) memstats.max_rss = mem.rss;
            if (mem.heapTotal > memstats.max_heap_total) memstats.max_heap_total = mem.heapTotal;
            if (mem.heapUsed > memstats.max_heap) memstats.max_heap = mem.heapUsed;
        }
        return cb();
      });
    }

    console.log("Running benchmark...");
    var time = +(new Date());

    for (var i = 1; i <= iterations; i++) {
        tiles.forEach(function(tile) {
            queue.defer(run,tile);
        });
    }

    queue.awaitAll(function(error) {
      if (error) throw error;
      if (runs != iterations*tiles.length) {
        throw new Error("Error: did not run as expected");
      }
      // check rate
      time = +(new Date()) - time;

      if (time == 0) {
        console.log("Warning: ms timer not high enough resolution to reliably track rate. Try more iterations");
      } else {
        // number of milliseconds per iteration
        var rate = runs/(time/1000);
        console.log('Benchmark speed: ' + rate.toFixed(0) + ' runs/s (runs:' + runs + ' ms:' + time + ' )');

        if (track_mem) {
            console.log('Benchmark peak mem: ',bytes(memstats.max_rss),bytes(memstats.max_heap),bytes(memstats.max_heap_total));
        } else {
            console.log('Note: pass --mem to track memory usage');
        }
      }

      console.log("Benchmark iterations:",argv.iterations,"concurrency:",argv.concurrency);
      var min_rate = 1000;
      if (process.platform === 'darwin' && process.env.TRAVIS !== undefined) {
        min_rate = 1300;
      }
      if (rate > min_rate) {
        console.log("Success: rate("+rate+" ops/s) > min_rate("+min_rate+")");
      } else {
        console.error("Fail: rate("+rate+" ops/s) <= min_rate("+min_rate+")");
        process.exit(-1);
      }
      process.exit(0);
    });
};