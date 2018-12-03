var Shaver = require('../');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var test = require('tape');
var path = require('path');
var propertyrJSON = './fixtures/properties/floating-filter.json';
// var pngRender = require('./tools/tile-render-comapre').getImg;

const TilesPath = __dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf';
const StylePath = './test/tools/.fxitures/style.json'


var sfTileBuffer = fs.readFileSync(TilesPath);
var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync(StylePath).toString()));

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


test('property key value filter', t => {
  var filters = new Shaver.Filters(filter_obj);
  Shaver.shave(sfTileBuffer, { filters, zoom: 14 }, function(err, shavedTile) {
    if (err) throw err;
    t.equals(sfTileBuffer.length, 7718, 'the size before shave ');
    t.equals(shavedTile.length, 4530, 'the size after the shave ');
    if (process.env.UPDATE) {
      fs.writeFileSync(path.resolve(__dirname, propertyrJSON), JSON.stringify(filters));
    }
    const ShavedTilePath = __dirname + '/fixtures/tiles/sf_16_10465_25329.shaved.vector.pbf';
    fs.writeFileSync(ShavedTilePath, shavedTile);
    t.deepEquals(filters, require(propertyrJSON), 'property key value filter correctly');
    //
    // pngRender(
    //   TilesPath, {
    //     zoom: 16,
    //     center: [-122.511291, 37.781569],
    //     style: StylePath
    //   }
    // );
    // //
    // pngRender(
    //   ShavedTilePath, {
    //     zoom: 16,
    //     center: [-122.511291, 37.781569],
    //     style: StylePath
    //   }
    // )
    t.end();
  });
});