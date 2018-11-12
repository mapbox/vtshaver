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



// test expressin
function vtinfo(buffer) {
  var tile = new vt(new pbf(buffer));
  var layerInfo = {};
  var info = {
    layers: []
  };
  Object.keys(tile.layers).forEach(function(k) {
    var lay = tile.layers[k];
    let propertyKies = {};
    for (var i = 0; i < lay.length; i++) {
      let features = lay.feature(i).toGeoJSON(0, 0, 0);
      Object.keys(features.properties).forEach(key => {
        propertyKies[key] = true;
      });
    }

    layerInfo[k] = {
      features: lay.length,
      properties: JSON.stringify(Object.keys(propertyKies))
    }
  });
  return layerInfo;
}


test('property key value filter size check', t => {
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    "layers": [
      { "id": "landuse", "source-layer": "landuse" },
      { "id": "water", "source-layer": "water" },
      { "id": "building", "source-layer": "building" },
      { "id": "road", "source-layer": "road" },
      { "id": "poi_label", "source-layer": "poi_label" },
      { "id": "road_label", "source-layer": "road_label" },
      { "id": "housenum_label", "source-layer": "housenum_label" }
    ]
  }));
  Shaver.shave(sfTileBuffer, { filters, zoom: 14 }, function(err, shavedTile) {
    if (err) throw err;
    t.equals(sfTileBuffer.length, 7718, 'the size before shave of sf tile');
    t.equals(shavedTile.length, 5514, 'the size after the shave of sf tile');
  });
  Shaver.shave(z16HousenumBuffer, { filters, zoom: 14 }, function(err, shavedTile) {
    if (err) throw err;
    t.equals(z16HousenumBuffer.length, 30607, 'the size before shave of z16 Housenum');
    t.equals(shavedTile.length, 16780, 'the size after the shave of z16 Housenum');
  });
  t.end();
});


test('property key value filter', t => {
  var filters = new Shaver.Filters(filter_obj);
  Shaver.shave(sfTileBuffer, { filters, zoom: 14 }, function(err, shavedTile) {
    if (err) throw err;
    t.equals(sfTileBuffer.length, 7718, 'the size before shave in round2 test');
    t.equals(shavedTile.length, 6609, 'the size after the shave in round2 test');
    if (process.env.UPDATE) {
      fs.writeFileSync(path.resolve(__dirname, propertyrJSON), JSON.stringify(filters));
    }
    t.deepEquals(filters, require(propertyrJSON), 'property key value filter correctly');
    t.end();
  });
});