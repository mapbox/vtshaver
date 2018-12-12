var Shaver = require('../');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var test = require('tape');
var path = require('path');
var propertyrJSON = './fixtures/properties/floating-filter.json';


var sfTileBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf');
var z16HousenumBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/z16-housenum.mvt');
// var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync('./test/fixtures/styles/properties.json').toString()));



var filter_obj = Shaver.styleToFilters({
  "layers": [
    { "id": "landuse", "source-layer": "landuse", filter: true, layout: { "expression-test5": ["==", ["get", "class"], "false"] } },
    { "id": "water", "source-layer": "water", filter: true, layout: { "expression-test5": ["==", ["get", "class"], "false"] } },
    { "id": "building", "source-layer": "building", filter: true, layout: { "expression-test5": ["==", ["get", "class"], "false"] } },
    { "id": "road", "source-layer": "road", filter: true, layout: { "expression-test5": ["==", ["get", "class"], "false"] } },
    { "id": "poi_label", "source-layer": "poi_label", filter: true, layout: { "expression-test5": ["==", ["get", "class"], "false"] } },
    { "id": "road_label", "source-layer": "road_label", filter: true, layout: { "expression-test5": ["==", ["get", "class"], "false"] } },
    { "id": "housenum_label", "source-layer": "housenum_label", filter: true, layout: { "expression-test5": ["==", ["get", "class"], "false"] } }
  ]
});
var filters = new Shaver.Filters(filter_obj);
for (var i = 0; i < 1000000; i++) {
  Shaver.shave(sfTileBuffer, { filters, zoom: 14 }, function(err, shavedTile) {});
}

console.log('done')