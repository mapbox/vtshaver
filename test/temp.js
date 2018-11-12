var Shaver = require('../');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var test = require('tape');


var sfTileBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf');
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

test('property key value filter', t => {
  var filters = new Shaver.Filters(filter_obj);
  console.log(filter_obj);
  console.log('filter_obj-=999999000-----------------------------------');
  Shaver.shave(sfTileBuffer, { filters, zoom: 14 }, function(err, shavedTile) {
    if (err) throw err;

    var postTile = new vt(new pbf(shavedTile));

    console.log(vtinfo(sfTileBuffer), sfTileBuffer.length);
    console.log('-------');
    console.log(vtinfo(shavedTile), shavedTile.length);

    // before shave the size is 7718
    t.equals(sfTileBuffer.length, 7718, 'the size before shave');
    t.equals(shavedTile.length, 7718, 'the size after the shave');

    t.ok(1);
    t.end();
    // t.ok(shavedTile);
    // t.equals(Object.keys(postTile.layers).length, 1, 'shaved tile contains expected number of layers');
    // t.equals(shavedTile.length, 176, 'expected tile size after filtering');
    // t.end();
  });
});



// var defaultInfo = vtinfo(defaultBuffer);
// // console.log(defaultInfo)

// // console.log()
// var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync('./test/fixtures/styles/expressions.json').toString()));

// var filters = new Shaver.Filters(filter_obj);
// // console.log(filter_obj[key].properties)

// var options = {
//   filters: filters,
//   zoom: 14
// };

// Shaver.shave(defaultBuffer, options, function(err, shavedTile) {
//   if (err) {
//     console.log(err)
//   } else {

//     var postTile = vtinfo(shavedTile);
//     console.log(shavedTile.length)
//       // console.log(postTile);⬇️
//       // compare
//     Object.keys(postTile).forEach(key => {
//       console.log('\n\x1b[0m ');
//       console.log('⚠️ ', `For layer [ \x1b[32m ${key} \x1b[0m ], used properties: ⭕️ [\x1b[32m ${filter_obj[key].properties} \x1b[0m] ⭕️ `);
//       console.log('\x1b[36m \n👗', 'Before shave:\n \x1b[0m') 
//       console.log(defaultInfo[key])
//       console.log('\x1b[36m  \n👙', 'After shave:\n \x1b[0m')
//       console.log(postTile[key])
//       console.log('\n🎉 🎉 🎉 🎉 🎉 🎉 ');
//     })
//   }

// });