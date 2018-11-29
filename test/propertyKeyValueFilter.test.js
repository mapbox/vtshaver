var Shaver = require('../');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var test = require('tape');
var path = require('path');
var propertyrJSON = './fixtures/properties/floating-filter.json';


var sfTileBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf');
var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync('./test/fixtures/styles/properties.json').toString()));


test('property key value filter', t => {
  var filters = new Shaver.Filters(filter_obj);
  Shaver.shave(sfTileBuffer, { filters, zoom: 14 }, function(err, shavedTile) {
    if (err) throw err;
    t.equals(sfTileBuffer.length, 7718, 'the size before shave ');
    t.equals(shavedTile.length, 6609, 'the size after the shave ');
    if (process.env.UPDATE) {
      fs.writeFileSync(path.resolve(__dirname, propertyrJSON), JSON.stringify(filters));
    }
    fs.writeFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.shaved.vector.pbf', shavedTile);
    t.deepEquals(filters, require(propertyrJSON), 'property key value filter correctly');
    t.end();
  });
});