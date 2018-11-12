var Shaver = require('../');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');

function vtinfo(buffer) {
  var tile = new vt(new pbf(buffer));
  var layerInfo = {};
  var info = {
    layers: []
  };
  Object.keys(tile.layers).forEach(function(k) {
    var lay = tile.layers[k];

    // let propertiesLength = 0;
    let propertyKies = {};
    for (var i = 0; i < lay.length; i++) {

      let features = lay.feature(i).toGeoJSON(0, 0, 0);
      //   if (k === 'road') {
      //     // console.log(features.properties)
      //   }


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

var defaultBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf');
var defaultInfo = vtinfo(defaultBuffer);
// console.log(defaultInfo)

// console.log()
var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync('./test/fixtures/styles/expressions.json').toString()));
// console.log(JSON.stringify(filter_obj, '', 4))

/**
 * {"landuse": {
        "filters": [
            
        ],
        "minzoom": 0,
        "maxzoom": 22,
        "properties": [
            "underground4",
            "underground",
            "underground1"
        ]
    }}
 */

var filters = new Shaver.Filters(filter_obj);
// console.log(filter_obj[key].properties)

var options = {
  filters: filters,
  zoom: 14
};

Shaver.shave(defaultBuffer, options, function(err, shavedTile) {
  if (err) {
    console.log(err)
  } else {
    var postTile = vtinfo(shavedTile);
    // console.log(postTile);⬇️
    // compare
    Object.keys(postTile).forEach(key => {
      console.log('\n\x1b[0m ');
      console.log('⚠️ ', `For layer [ \x1b[32m ${key} \x1b[0m ], used properties: ⭕️ [\x1b[32m ${filter_obj[key].properties} \x1b[0m] ⭕️ `);
      console.log('\x1b[36m \n👗', 'Before shave:\n \x1b[0m') 
      console.log(defaultInfo[key])
      console.log('\x1b[36m  \n👙', 'After shave:\n \x1b[0m')
      console.log(postTile[key])
      console.log('\n🎉 🎉 🎉 🎉 🎉 🎉 ');
    })
  }

});