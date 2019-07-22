// import {isExpression} from ;
let styleSpec = require('@mapbox/mapbox-gl-style-spec');

const DEFAULT_MAX_ZOOM = 22;

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
  if (style && style.layers) {
    for (var i = 0; i < style.layers.length; i++) {
      var layerName = style.layers[i]['source-layer'];
      if (layerName) {
        // if the layer already exists in our filters, update it
        if (layers[layerName]) {
          // Update zoom levels
          var styleMin = style.layers[i].minzoom || 0;
          var styleMax = style.layers[i].maxzoom || DEFAULT_MAX_ZOOM;
          if (styleMin < layers[layerName].minzoom) layers[layerName].minzoom = styleMin;
          if (styleMax > layers[layerName].maxzoom) layers[layerName].maxzoom = styleMax;
          // Modify filter
          if (layers[layerName].filters === true || !style.layers[i].filter) {
            layers[layerName].filters = true;
          } else {
            layers[layerName].filters.push(getFilterForLayer(style.layers[i]));
          }
        } else {
          // otherwise create the layer & filter array, with min/max zoom
          layers[layerName] = {};
          layers[layerName].filters = style.layers[i].filter ? ['any', getFilterForLayer(style.layers[i])] : true;
          layers[layerName].minzoom = style.layers[i].minzoom || 0;
          layers[layerName].maxzoom = style.layers[i].maxzoom || DEFAULT_MAX_ZOOM;
        }

        // Collect the used properties 
        // 1. from paint, layout, and filter
        layers[layerName].properties = layers[layerName].properties || [];
        ['paint', 'layout'].forEach(item => {
          let itemObject = style.layers[i][item];
          itemObject && getPropertyFromLayoutAndPainter(itemObject, layers[layerName].properties);
        });
        // 2. from filter
        if (style.layers[i].filter) {
          getPropertyFromFilter(style.layers[i].filter, layers[layerName].properties);
        }
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
  });
  return layers;
}

function getFilterForLayer(layer) {
  const minzoom = layer.minzoom || 0;
  const maxzoom = layer.maxzoom || DEFAULT_MAX_ZOOM;
  if (minzoom === 0 && maxzoom >= DEFAULT_MAX_ZOOM) {
    // The filter applies for the complete zoom range - no need to filter by zoom
    return layer.filter;
  }

  var result = ['all', layer.filter];
  if (minzoom > 0) {
    result.push(['>=', ['zoom'], minzoom]);
  }
  if (maxzoom < DEFAULT_MAX_ZOOM) {
    result.push(['<=', ['zoom'], maxzoom]);
  }
  return result;
}

function getPropertyFromFilter(filter, properties) {
  if (styleSpec.expression.isExpression(filter)) {
    getPropertyFromExpression(filter, properties);
  }

  // Warning: Below code should put in to an else conditions,
  // but since the `isExpression` can not tell it is a expression or filter syntax I put it outsied the else
  // this could reduce the performance or cause some potential bugs, we must keep an eye on this.

  // else {
  let subFilter = [];
  for (let i = 0; i < filter.length; i++) {
    if (typeof filter[i] === 'object' && filter[i] instanceof Array) {
      subFilter.push(filter[i]);
    }
  }

  if (subFilter.length > 0) {
    subFilter.forEach(sfilter => {
      getPropertyFromFilter(sfilter, properties);
    })
  } else {
    if (filter.length >= 3 && typeof filter[1] === 'string') {
      if (filter[1].indexOf('$') === -1) {
        properties.push(filter[1]);
      }

    }
  }
  // }
}


function getPropertyFromLayoutAndPainter(propertyObj, properties) {
  Object.keys(propertyObj).forEach(key => {
    let value = propertyObj[key];
    // TODO we still have outher situation:
    // - special properties: `mapbox_clip_start`, `mapbox_clip_end`
    if (typeof value === 'string') {
      // if the value is string try to get property name from `xx{PropertyName}xx` like.
      // the /{[^}]+}/ig return all the value like {xxx}
      // eg 'a{hello}badfa' => ['{hello}']
      // eg 'a{hello}ba{world}dfa' => ['{hello}','{world}']
      let preProperties = value.match(/{[^}]+}/ig);
      preProperties && preProperties.forEach(item => {
        properties.push(item.slice(1, -1));
      });
    } else if (typeof value === 'object' && typeof value.property === 'string') {
      // - legacy functions with `property`
      properties.push(value.property);
    } else {
      // test isExpression from sytleSpec
      if (styleSpec.expression.isExpression(value)) {
        // TODO: now we implement this by ourself in vtshavem, we need to talk with ‘style spec’ member to see if there have a official method to get used property, to make this can be synchronized with the expression update.
        getPropertyFromExpression(value, properties);
      } else {
        // otherwise continual loop;
        getPropertyFromLayoutAndPainter(value, properties);
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
