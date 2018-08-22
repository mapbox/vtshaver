var test = require('tape');
var Shaver = require('../lib/index.js');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var zlib = require('zlib');
var mvtf = require('@mapbox/mvt-fixtures');
var SHOW_COMPARE = process.env.SHOW_COMPARE;
var SHOW_ERROR = process.env.SHOW_ERROR;

function vtinfo(buffer) {
  var tile = new vt(new pbf(buffer));
  var info = {
    layers : []
  };
  Object.keys(tile.layers).forEach(function(k) {
    var lay = tile.layers[k];
    info.layers.push({
      name:k,
      features:lay.length
    })
  });
  return info;
}

// Custom VTs
var defaultBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/sf_16_10465_25329.vector.pbf');
var defaultInfo = vtinfo(defaultBuffer);

// styles
var style_cafe = require('./fixtures/styles/cafe.json');
var style_water = require('./fixtures/styles/water.json');
var style_one_feature = require('./fixtures/styles/one-feature.json');
var style_expressions_legacy = require('./fixtures/styles/expressions-legacy.json');
var style_expressions = require('./fixtures/styles/expressions.json');

// making sure we don't change our fixtures accidentally
test('buffer pre-test', function(t) {
  t.equals(defaultBuffer.length, 7718, 'expected pbf size before filtering');
  t.equals(defaultInfo.layers.length, 7, 'pre-shaved tile contains expected number of layers');
  t.end();
});

test('success: passing compress object as part of options - no compression ', function(t) {
  var buffer = mvtf.get('043').buffer;
  var sizeBefore = buffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  var options = {
    filters: filters,
    zoom: 14,
    compress: {
      type: 'none'
    }
  };

  Shaver.shave(buffer, options, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.notOk(shavedTile[0] == 0x1f && shavedTile[1] == 0x8b, 'shaved tile is uncompressed');
    t.equals(postTile.layers.length, 1, 'shaved tile contains expected number of layers');
    t.equals(postTile.layers[0].name, 'park_features', 'shaved tile contains expected layer');
    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: passing compress object as part of options - negative compression level ', function(t) {
  var buffer = mvtf.get('043').buffer;
  var sizeBefore = buffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  var options = {
    filters: filters,
    zoom: 14,
    compress: {
      type: 'gzip',
      level: -1
    }
  };

  Shaver.shave(buffer, options, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'compress option \'level\' must be an unsigned integer', 'expected error message');
    t.end();
  });
});

test('success: passing compress object as part of options - gzip compression ', function(t) {
  var buffer = mvtf.get('043').buffer;
  var sizeBefore = buffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  var options = {
    filters: filters,
    zoom: 14,
    compress: {
      type: 'gzip'
    }
  };

  // Compress the tile beforehand, for code coverage
  zlib.gzip(buffer, function(err, compressedBuffer) {
    if (err) throw err;

    Shaver.shave(compressedBuffer, options, function(err, compressedShavedTile) {
      if (err) throw err;
      t.ok(compressedShavedTile);
      t.ok(compressedShavedTile[0] == 0x1f && compressedShavedTile[1] == 0x8b, 'shaved tile is compressed');

      // Decompress the tile before we can assert its contents
      zlib.gunzip(compressedShavedTile, function(err, decompressedShavedTile) {
        var postTile = vtinfo(decompressedShavedTile);
        t.equals(postTile.layers.length, 1, 'shaved tile contains expected number of layers');
        t.equals(postTile.layers[0].name, 'park_features', 'shaved tile contains expected layer');
        t.ok((decompressedShavedTile.length < sizeBefore && decompressedShavedTile.length !== 0), 'successfully shaved');
        if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
        t.end();
      });
    });
  });
});

test('failure: invalid buffer - catches during decompression', function(t) {
  var buffer = mvtf.get('043').buffer;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  var options = {
    filters: filters,
    zoom: 14
  };

  // Creating an invalid buffer so that it gets caught in gzip::is_compressed
  // https://github.com/mapbox/gzip-hpp/blob/master/include/gzip/utils.hpp#L8
  // https://nodejs.org/api/buffer.html#buffer_buf_index
  buffer[0] = 0x78;
  buffer[1] = 0x9C;

  // TODO: Explicitly handle this super vague error message
  // and return something more relevant
  Shaver.shave(buffer, options, function(err, compressedShavedTile) {
    t.ok(err);
    t.equals(err.message, 'invalid stored block lengths', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid compress options, missing type', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  var options = {
    filters: filters,
    zoom: 14,
    compress: {
      woops: 6
    }
  };

  Shaver.shave(defaultBuffer, options, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'compress option \'type\' not provided. Please provide a compression type if using the compress option', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid compress type', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  var options = {
    filters: filters,
    zoom: 14,
    compress: {
      type: 6
    }
  };

  Shaver.shave(defaultBuffer, options, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'compress option \'type\' must be a string', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid compress type value', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  var options = {
    filters: filters,
    zoom: 14,
    compress: {
      type: 'woops'
    }
  };

  Shaver.shave(defaultBuffer, options, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'compress type must equal \'none\' or \'gzip\'', 'expected error message');
    t.end();
  });
});

test('success: layers sucessfully shaved (mvt-fixtures)', function(t) {
  var buffer = mvtf.get('043').buffer;
  var sizeBefore = buffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "park_features",
        filter: ["==","poi","slide"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 14}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 1, 'shaved tile contains expected number of layers');
    t.equals(postTile.layers[0].name, 'park_features', 'shaved tile contains expected layer');
    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

// Currently, vtshaver doesnt filter individual features (soon!), so this test case (from my understanding)
// is making sure that a specific feature id is detected, and the layer that feature lives in will be retained.
// hmmmmm....though now I'm wondering if the property id even has anything to do with the fact that this layer is retained...
test('success: layers sucessfully shaved - detect one feature', function(t) {
  var sizeBefore = defaultBuffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "landuse",
        "filter": [ "==", "$id", 21420264 ]
      }
    ]
  }));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 14}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 1, 'shaved tile contains expected number of layers');
    t.equals(postTile.layers[0].name, 'landuse', 'shaved tile contains expected layer');
    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

// I dont understand the purpose of this test. Was past-Carol trying to tell present-Carol something?
test('success: layers sucessfully shaved - no features', function(t) {
  var sizeBefore = defaultBuffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters(style_one_feature));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 14}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 0, 'shaved tile contains expected number of layers');
    t.equals(shavedTile.length, 0, 'expected tile size after filtering');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: layers shaved successfully - empty layer (coverage)', function(t) {
  var buffer = mvtf.get('025').buffer;
  var sizeBefore = buffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello"
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 0, 'shaved tile has no layers because layer was empty');
    t.equals(shavedTile.length, 0, 'expected tile size after filtering');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: layers shaved successfully - tile zoom irrelevant to style zoom', function(t) {
  var sizeBefore = defaultBuffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "poi_label",
        filter: ["!=","maki","cafe"],
        minzoom: 14,
        maxzoom: 15
      }
    ]
  }));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 1}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 0, 'shaved tile has no layers because of zoom');
    t.equals(shavedTile.length, 0, 'expected tile size after filtering');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: layers shaved successfully - specifying tileset maxzoom will keep layer data if < style layer minzoom (representative of an overzoomed style definition)', function(t) {
  var sizeBefore = defaultBuffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters(
    { layers: [
        {
          "source-layer": "poi_label",
          minzoom: 14
        }
      ]
    }
  ));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 1, maxzoom: 1}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 1, 'shaved tile has one layer');
    t.equals(postTile.layers[0].name, 'poi_label', 'shaved tile contains expected layer');
    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: layers sucessfully shaved, feature filtering successfully retains the entire layer', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters(style_water));
  var sizeBefore = defaultBuffer.length;

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 16}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 1, 'shaved tile contains expected number of layers');
    t.equals(postTile.layers[0].name, 'water', 'shaved tile contains expected layer');
    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: layers sucessfully shaved, features shaved - equal ==', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters(style_cafe));
  var sizeBefore = defaultBuffer.length;

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 16}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 1, 'shaved tile contains expected number of layers');
    t.equals(postTile.layers[0].features, 1, 'expected number of features after filtering');
    t.equals(postTile.layers[0].name, 'poi_label', 'shaved tile contains expected layer');
    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: evaluate function returns empty object because no matches', function(t) {
  var sizeBefore = defaultBuffer.length;
  var beforeTile = vtinfo(defaultBuffer);
  var filters = new Shaver.Filters(Shaver.styleToFilters({
  layers: [
      {
        "source-layer": "poi_label",
        filter: ["to-boolean", ["get", "cats", ["properties"]]],
        minzoom: 14,
        maxzoom: 16
      }
    ]
  }));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 15}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 0, 'shaved tile has no layers because no cats properties matched');
    t.equals(shavedTile.length, 0, 'expected tile size after filtering');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: layers successfully shaved, features shaved - not equal !=', function(t) {
  var sizeBefore = defaultBuffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
  layers: [
      {
        "source-layer": "poi_label",
        filter: ["!=","maki","cafe"]
      }
    ]
  }));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 16}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 1, 'shaved tile contains expected number of layers');
    t.equals(postTile.layers[0].features, 12, 'expected number of features after filtering');
    t.equals(postTile.layers[0].name, 'poi_label', 'shaved tile contains expected layer');
    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: multiple filters for different source-layers', function(t) {
  var sizeBefore = defaultBuffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "poi_label",
        filter: ["==","maki","toilet"]
      },
      {
        "source-layer": "road",
        filter: ["!=","class","path"]
      }
    ]
  }));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 16}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);

    t.ok(shavedTile);
    t.equals(postTile.layers.length, 2, 'shaved tile contains expected number of layers');

    // road
    t.equals(postTile.layers[0].features, 10, 'expected number of features after filtering');
    t.equals(postTile.layers[0].name, 'road', 'shaved tile contains poi_label layer');

    // poi_label
    t.equals(postTile.layers[1].features, 2, 'expected number of features after filtering');
    t.equals(postTile.layers[1].name, 'poi_label', 'shaved tile contains poi_label layer');

    t.ok((shavedTile.length < sizeBefore && shavedTile.length !== 0), 'successfully shaved');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: no matching filters result in vt without layers', function(t) {
  var sizeBefore = defaultBuffer.length;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "roads",
        filter: ["==","waka","flocka"]
      }
    ]
  }));

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 16}, function(err, shavedTile) {
    if (err) throw err;
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile);
    t.equals(postTile.layers.length, 0, 'shaved tile contains no layers');
    if (SHOW_COMPARE) console.log("**** Tile size before: " + sizeBefore + "\n**** Tile size after: " + shavedTile.length);
    t.end();
  });
});

test('success: correctly parses feature without ID field (issue#75)', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==", ["id"], "foo"]
      }
    ]
  }));
  var buffer = fs.readFileSync(__dirname + '/fixtures/tiles/feature-single-point-no-id.mvt');
  var bufferInfo = vtinfo(buffer);
  t.equals(bufferInfo.layers.length, 1, 'original tile has one layer');

  Shaver.shave(buffer, {filters: filters, zoom: 2}, function(err, shavedTile) {
    t.ifError(err);
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile, 'tile was shaved without error');
    t.equals(postTile.layers.length, 0, 'shaved tile contains no layers');
    t.end();
  });
});

// Ultimately, shaver doesnt care if the value of "zoom" passed in is different than the actual tile z
// Seems like all same rules apply as long as the tile's zoom is relevant to the filter/style zooms
test('pass in an overzoomed z (different than the buffer itself) - see what happens', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters({layers: [{
    "id": "housenum-label",
    "type": "symbol",
    "source": "composite",
    "source-layer": "housenum_label",
    "minzoom": 17
  }]}));

  var buffer = fs.readFileSync(__dirname + '/fixtures/tiles/z16-housenum.mvt');
  var bufferInfo = vtinfo(buffer);
  t.equals(bufferInfo.layers.length, 7, 'original tile has two layers');

  Shaver.shave(buffer, {filters: filters, zoom: 17}, function(err, shavedTile) {
    t.ifError(err);
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile, 'tile was shaved without error');
    t.equals(postTile.layers.length, 1, 'shaved tile contains one layer');
    t.equals(postTile.layers[0].name, 'housenum_label', 'correct layer name');
    t.end();
  });
});

test('test to ensure nullfilter & inside min/maxzoom bounds results in layer being kept', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters({layers: [{
    "id": "housenum-label",
    "type": "symbol",
    "source": "composite",
    "source-layer": "housenum_label",
    "minzoom": 17
  }]}));

  var buffer = fs.readFileSync(__dirname + '/fixtures/tiles/z16-housenum.mvt');
  var bufferInfo = vtinfo(buffer);
  t.equals(bufferInfo.layers.length, 7, 'original tile has seven layers');

  Shaver.shave(buffer, {filters: filters, zoom: 16, maxzoom: 16}, function(err, shavedTile) {
    t.ifError(err);
    var postTile = vtinfo(shavedTile);
    t.ok(shavedTile, 'tile was shaved without error');
    t.equals(postTile.layers.length, 1, 'shaved tile contains one layer');
    t.equals(postTile.layers[0].name, 'housenum_label', 'correct layer name');
    t.end();
  });
});

test('succeed: expression filters - z16', function(t) {
  var sizeBefore = defaultBuffer.length;
  var bufferInfo = vtinfo(defaultBuffer);
  var filters = new Shaver.Filters(Shaver.styleToFilters(style_expressions));

  t.equals(bufferInfo.layers.length, 7, 'original tile has seven layers');

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 16, maxzoom: 16}, function(err, shavedTile) {
    t.ifError(err);
    var postTile = vtinfo(shavedTile);

    t.ok(shavedTile, 'tile was shaved without error');
    t.equals(postTile.layers.length, 5, 'shaved out road-label (not in the style) and poi_label (filter)');
    t.end();
  });
});

test('succeed: expression filters - z14', function(t) {
  var sizeBefore = defaultBuffer.length;
  var bufferInfo = vtinfo(defaultBuffer);
  var filters = new Shaver.Filters(Shaver.styleToFilters(style_expressions));

  t.equals(bufferInfo.layers.length, 7, 'original tile has seven layers');

  Shaver.shave(defaultBuffer, {filters: filters, zoom: 14, maxzoom: 16}, function(err, shavedTile) {
    t.ifError(err);
    var postTile = vtinfo(shavedTile);

    t.ok(shavedTile, 'tile was shaved without error');
    t.equals(postTile.layers.length, 4, 'shaved out road-label (not in style), building (minzoom), and poi_label (filter)');
    t.end();
  });
});

// Per https://github.com/mapbox/mapbox-gl-native/pull/12065
test('failure: legacy + expression filter not supported', function(t) {
  var result = Shaver.styleToFilters(style_expressions_legacy);
  try {
    var filters = new Shaver.Filters(result);
  } catch(err) {
    t.ok(err);
    t.equals(err.message, 'Unable to create Filter object, ensure all filters are expression-based', 'expected error due to legacy/expression combo filter');
    t.end();
  }
});

test('failure: creating Shaver.Filters() with invalid object', function(t) {
  try {
    var filters = new Shaver.Filters(null);
    t.ok(false);
  } catch (err) {
    t.ok(err);
    t.equals(err.message, 'filters must be an object and cannot be null or undefined');
    t.end();
  }
});

test('failure: Shaver.Filters(): invalid filter', function(t) {
  try {
    var filters = new Shaver.Filters({
      "poi_label": {filters: 2, minzoom: 0, maxzoom: 22 }
    });
    t.ok(false);
  } catch (err) {
    t.ok(err);
    t.equals(err.message, 'invalid filter value, must be an array or a boolean');
    t.end();
  }
});

test('failure: creating Shaver.Filters() with invalid Filter object', function(t) {
  try {
    var filters = new Shaver.Filters({ "poi_label": {filters: [0], minzoom: 0, maxzoom: 22} });
    t.ok(false);
  } catch (err) {
    t.ok(err);
    t.equals(err.message, 'filter operator must be a string');
    t.end();
  }
});

test('failure: creating Shaver.Filters() with invalid filters json', function(t) {
  try {
    var filters = new Shaver.Filters({'test': 'oops'});
    t.ok(false);
  } catch (err) {
    t.ok(err);
    t.equals(err.message, 'layer must be an object and cannot be null or undefined');
    t.end();
  }
});

test('failure: creating Shaver.Filters() without new', function(t) {
  try {
    var filters = Shaver.Filters({
      "poi_label": 2,
    });
    t.ok(false);
  } catch (err) {
    t.ok(err);
    t.equals(err.message, 'Cannot call constructor as function, you need to use \'new\' keyword');
    t.end();
  }
});

test('failure: Shaver.shave(): invalid buffer', function(t) {
  Shaver.shave('woops', {}, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'first arg \'buffer\' must be a Protobuf buffer object', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): undefined buffer', function(t) {
  Shaver.shave(undefined, {}, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'first arg \'buffer\' must be a Protobuf buffer object', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): undefined options', function(t) {
  Shaver.shave(defaultBuffer, undefined, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'second arg \'options\' must be an object', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): null options', function(t) {
  Shaver.shave(defaultBuffer, null, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'second arg \'options\' must be an object', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid options, not an object', function(t) {
  Shaver.shave(defaultBuffer, 'woops', function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'second arg \'options\' must be an object', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid VT throws protozero error', function(t) {
  var filters = new Shaver.Filters(Shaver.styleToFilters(style_expressions));
  var invalidBuffer = fs.readFileSync(__dirname + '/fixtures/tiles/invalid.mvt');

  Shaver.shave(invalidBuffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    t.ok(err);
    if (SHOW_ERROR) console.log(err.message);
    t.end();
  });
});

test('failure: Shaver.shave(): invalid filter: null', function(t) {
  Shaver.shave(defaultBuffer, {filters: null, zoom: 5}, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, "option 'filters' must be a shaver.Filters object");
    t.end();
  });
});

test('failure: Shaver.shave(): invalid filter: undefined', function(t) {
  Shaver.shave(defaultBuffer, {filters: undefined, zoom: 5}, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, "option 'filters' must be a shaver.Filters object");
    t.end();
  });
});

test('failure: Shaver.shave(): invalid filter: empty object', function(t) {
  Shaver.shave(defaultBuffer, {filters: {}, zoom: 5}, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, "option 'filters' must be a shaver.Filters object");
    t.end();
  });
});

test('failure: Shaver.shave(): missing filter', function(t) {
  Shaver.shave(defaultBuffer, {zoom: 5}, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, "must create a filters object using Shaver.Filters() and pass filters in to Shaver.shave");
    t.end();
  });
});

test('failure: Shaver.shave(): invalid zoom data type, string', function(t) {
  Shaver.shave(defaultBuffer, { filters: {}, zoom: 'not a number' }, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'option \'zoom\' must be a positive integer.', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid zoom data type, negative int', function(t) {
  Shaver.shave(defaultBuffer, { filters: {}, zoom: -4 }, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'option \'zoom\' must be a positive integer.', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid zoom data type, negative float', function(t) {
  Shaver.shave(defaultBuffer, { filters: {}, zoom: -6.8 }, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'option \'zoom\' must be a positive integer.', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): missing zoom', function(t) {
  Shaver.shave(defaultBuffer, { filters: {} }, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'option \'zoom\' not provided. Please provide a zoom level for this tile.', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave(): invalid maxzoom data type, negative float', function(t) {
  Shaver.shave(defaultBuffer, { filters: {}, zoom: 1, maxzoom: -6.8 }, function(err, shavedTile) {
    t.ok(err);
    t.equals(err.message, 'option \'maxzoom\' must be a positive integer.', 'expected error message');
    t.end();
  });
});

test('failure: Shaver.shave() minzoom not included', function(t) {
  try {
    var filters = new Shaver.Filters({ poi_label: { filters: [ 'any', [ '!=', 'maki', 'cafe' ] ], maxzoom: 15 } });
  } catch (err) {
    t.ok(err);
    t.equal(err.message, 'Filter must include a minzoom property.', 'expected error message');
    t.end();
  }
});

test('failure: Shaver.shave() maxzoom not included', function(t) {
  try {
    var filters = new Shaver.Filters({ poi_label: { filters: [ 'any', [ '!=', 'maki', 'cafe' ] ], minzoom: 15 } });
  } catch (err) {
    t.ok(err);
    t.equal(err.message, 'Filter must include a maxzoom property.', 'expected error message');
    t.end();
  }
});

test('failure: Shaver.shave() minzoom from styleToFilter is null', function(t) {
  try {
    var filters = new Shaver.Filters({ poi_label: { filters: [ 'any', [ '!=', 'maki', 'cafe' ] ], minzoom: null, maxzoom: 15 } });
  } catch (err) {
    t.ok(err);
    t.equal(err.message, 'Value for \'minzoom\' must be a positive number.', 'expected error message');
    t.end();
  }
});

test('failure: Shaver.shave() minzoom from styleToFilter is null', function(t) {
  try {
    var filters = new Shaver.Filters({ poi_label: { filters: [ 'any', [ '!=', 'maki', 'cafe' ] ], minzoom: 14, maxzoom: null } });
  } catch (err) {
    t.ok(err);
    t.equal(err.message, 'Value for \'maxzoom\' must be a positive number.', 'expected error message');
    t.end();
  }
});

test('failure: Shaver.shave() filters is null', function(t) {
  try {
    var filters = new Shaver.Filters({ poi_label: { filters: null, minzoom: 14, maxzoom: 15 } });
  } catch (err) {
    t.ok(err);
    t.equal(err.message, 'Filters is not properly constructed.', 'expected error message');
    t.end();
  }
});

test('failure: Shaver.shave(): invalid callback', function(t) {
  try {
    Shaver.shave(defaultBuffer, {}, 'woops');
  } catch (err) {
    t.ok(err);
    t.equals(err.message, 'last argument must be a callback function', 'expected error message');
    t.end();
  }
});
