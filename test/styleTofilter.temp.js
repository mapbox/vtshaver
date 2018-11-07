var Shaver = require('../');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');

function vtinfo(buffer) {
  var tile = new vt(new pbf(buffer));
  var info = {
    layers: []
  };
  Object.keys(tile.layers).forEach(function(k) {
    var lay = tile.layers[k];

    let propertiesLength = 0;
    for (var i = 0; i < lay.length; i++) {
      let features = lay.feature(i).toGeoJSON(0, 0, 0);
      //   console.log('properties-------', features.properties);
      propertiesLength += Object.keys(features.properties).length;
    }

    info.layers.push({
      name: k,
      features: lay.length,
      propertiesLength
    })
  });
  return info;
}

var defaultBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf');
var defaultInfo = vtinfo(defaultBuffer);
console.log(defaultInfo)

// console.log()
var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync('./test/fixtures/styles/expressions.json').toString()));
// console.log(JSON.stringify(filter_obj, '', 4))

var filters = new Shaver.Filters(filter_obj);

var options = {
  filters: filters,
  zoom: 14
};

Shaver.shave(defaultBuffer, options, function(err, shavedTile) {
  if (err) {
    console.log(err)
  } else {
    var postTile = vtinfo(shavedTile);
    console.log(postTile);
  }

});