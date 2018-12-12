var Shaver = require('../');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var test = require('tape');
var path = require('path');
var propertyrJSON = './fixtures/properties/floating-filter.json';


var sfTileBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf');
var z16HousenumBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/z16-housenum.mvt');
var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync('./test/fixtures/styles/properties.json').toString()));




test('property key value filter size check', t => {
  let FilterObj = Shaver.styleToFilters({
    "layers": [
      { "id": "landuse", "source-layer": "landuse" }
    ]
  });
  FilterObj.landuse.properties = null;
  //   var filters = new Shaver.Filters(null);
  //   FilterObj.landuse.properties = null

  try {
    var filters = new Shaver.Filters(FilterObj, (err) => {
      console.log(err);
    });
  } catch (err) {
    t.ok(err);
    t.equal(err.message, 'Property-Filters is not properly constructed.', 'expected error message');
    t.end();
  }
});


test('property key value filter size check', t => {
  let FilterObj = Shaver.styleToFilters({
    "layers": [{
      "id": "landuse",
      "source-layer": "landuse",
      layout: { "expression-test4": ["==", ["properties"], "false"] }
    }]
  });

  try {
    FilterObj.landuse.properties = false;
    var filters = new Shaver.Filters(FilterObj, (err) => {
      console.log(err);
    });
  } catch (err) {
    t.ok(err);
    t.equal(err.message, 'invalid filter value, must be an array or a boolean', 'expected error message');
    t.end();
  }
});