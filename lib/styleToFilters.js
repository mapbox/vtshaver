// import {isExpression} from ;
let styleSpec = require('@mapbox/mapbox-gl-style-spec');

/**
 * Takes optimized filter object from shaver.styleToFilters and returns c++ filters for shave.
 * @function styleToFilters
 * @param {Object} style -  Mapbox GL Style JSON
 * @example
 * var shaver = require('@mapbox/vtshaver');
 * var style = require('/path/to/style.json');
 * var filters = shaver.styleToFilters(style);
 * console.log(filters);
 * // {
 * //   "poi_label": ["!=","maki","cafe"],
 * //   "road": ["==","class","path"],
 * //   "water": true,
 * //   ...
 * // }
 */

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

        // Collect the used property
        layers[layerName].properties = layers[layerName].properties || [];
        ['paint', 'layout'].forEach(item => {
          let itemObject = style.layers[i][item];
          itemObject && stringPropertyLoop(itemObject, layers[layerName].properties);
        });
      }
    }
  }

  // remove duplicate propertys and fix choose all the propertys in layers[i].properties
  Object.keys(layers).forEach(layerId => {
    let properties = layers[layerId].properties;
    if (properties.indexOf(true) !== -1) {
      layers[layerId].properties = true;
    } else {
      let unique = {};
      properties.forEach(function(i) {
        if (!unique[i]) {
          unique[i] = true;
        }
      });
      layers[layerId].properties = Object.keys(unique);
    }
  })

  return layers;
}


function stringPropertyLoop(propertyObj, properties) {
  Object.keys(propertyObj).forEach(key => {
    let value = propertyObj[key];
    // TODO we still have outher two situations:
    // - legacy functions with `property`
    // - special properties: `mapbox_clip_start`, `mapbox_clip_end`
    if (typeof value === 'string') {
      // if the value is string try to get property name from `xx{PropertyName}xx` like.
      // the /{[^}]+}/ig return all the value like {xxx}
      // eg 'a{hello}badfa' => ['{hello}']
      // eg 'a{hello}ba{world}dfa' => ['{hello}','{world}']
      let preProperties = value.match(/{[^}]+}/ig);
      preProperties && preProperties.forEach(item => {
        properties.push(item.slice(1, -1))
      });
    } else {
      // test isExpression from sytleSpec
      if (styleSpec.expression.isExpression(value)) {
        // TODO: now we implement this by ourself in vtshavem, we need to talk with ‘style spec’ member to see if there have a official method to get used property, to make this can be synchronized with the expression update.
        getPropertyFromExpression(value, properties);
      } else {
        // otherwise continual loop;
        stringPropertyLoop(value, properties);
      }
    }
  })
}


function getPropertyFromExpression(exp, properties) {
  // now we care about the expression like:
  // ["get", string] not ["get", string, Object],
  // ["has", string] not ["has", string, Object],
  // ["properties"],
  // ["feature-state", string]
  if (exp instanceof Array) {
    switch (exp[0]) {
      case 'get':
      case 'has':
        if (typeof exp[1] === 'string' && !(exp[2] && typeof exp[2] === 'object')) {
          properties.push(exp[1]);
        }
        break;
      case 'feature-state':
        properties.push(exp[1]);
        break;
      case 'properties':
        properties.push(true);
        break;
    }

    exp.forEach(sub => {
      if (sub instanceof Array) {
        getPropertyFromExpression(sub, properties)
      }
    })
  }
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