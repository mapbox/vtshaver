var shaver = require('./lib/index.js');
// var style = require('./test/fixtures/styles/bright-v9.json');
// var filters = shaver.styleToFilters(style);
// console.log(JSON.stringify(filters, '', 4));


var fs = require('fs');

var buffer = fs.readFileSync('./test/fixtures/tiles/sf_16_10465_25329.vector.pbf');
var style = require('./test/fixtures/styles/bright-v9.json');
var filters = new shaver.Filters(shaver.styleToFilters(style));
// console.log(shaver.styleToFilters(style))

// console.log('filters', filters);


// // console.log(filters)
var options = {
    filters: filters, // required
    zoom: 14, // required
    maxzoom: 16, // optional
    compress: { // optional
        type: 'none'
    }
};

shaver.shave(buffer, options, function(err, shavedTile) {
    // console.log('err', shavedTile);
      if (err) throw err;
    //   console.log(shavedTile); // => vector tile buffer
});