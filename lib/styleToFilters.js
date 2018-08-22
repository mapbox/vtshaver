function styleToFilters(style) {
  var layers = {};
  // Store layers and filters used in style
  if (style.layers) {
    for (var i = 0; i < style.layers.length; i++) {
      var layerName = style.layers[i]['source-layer'];
      if (layerName) {
        // if the layer already exists in our filters, update it
        if (layers[layerName]) {
          // Update zoom levels
          var styleMin = style.layers[i].minzoom || 0;
          var styleMax = style.layers[i].maxzoom || 22;
          if (styleMin < layers[layerName].minzoom) layers[layerName].minzoom = styleMin;
          if (styleMax > layers[layerName].maxzoom) layers[layerName].maxzoom = styleMax;
          // Modify filter
          if (layers[layerName].filters === true || !style.layers[i].filter) {
            layers[layerName].filters = true;
          } else {
            layers[layerName].filters.push(style.layers[i].filter);
          }
        } else {
          // otherwise create the layer & filter array, with min/max zoom
          layers[layerName] = {};
          layers[layerName].filters = style.layers[i].filter ? ['any', style.layers[i].filter] : true;
          layers[layerName].minzoom = style.layers[i].minzoom || 0;
          layers[layerName].maxzoom = style.layers[i].maxzoom || 22;
        }
      }
    }
  }

  return layers;
}

module.exports = styleToFilters;

// cli tool
if (require.main === module) {
  var fs = require('fs');
  var path = require('path');
  var JSONStream = require('JSONStream');

  if (process.argv.length === 3) {
    var styleString = fs.readFileSync(path.resolve(process.argv[2]));
    var style = JSON.parse(styleString);
    console.log(JSON.stringify(styleToFilters(style)));
  } else if (process.argv.length === 2) {
    process.stdin
      .pipe(JSONStream.parse())
      .on('data', function(style) {
        console.log(JSON.stringify(styleToFilters(style)));
      });
  } else {
    throw new Error('wrong number of arguments\n' +
            'Usage:\n' +
            '  node ./lib/styles-to-filter.js ./fixtures/style.json\n' +
            'or\n' +
            '  node ./lib/styles-to-filter.js < ./fixtures/style.json');
  }
}
