var test = require('tape');
var Shaver = require('../lib/index.js');
var fs = require('fs');
var vt = require('@mapbox/vector-tile').VectorTile;
var pbf = require('pbf');
var fixtures = require('@mapbox/mvt-fixtures');
var SHOW_ERROR = process.env.SHOW_ERROR;

var genericFilter = new Shaver.Filters(Shaver.styleToFilters({
  layers: [
    {
      "source-layer": "layer_name",
      filter: ["==","string","hello"]
    }
  ]
}));

test('validator: layers successfully shaved, all value types', function(t) {
  var buffer = fixtures.get('038').buffer;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==","string_value","ello"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    if (err) throw err;
    var postTile =  new vt(new pbf(shavedTile));
    t.ok(shavedTile);
    t.equals(Object.keys(postTile.layers).length, 1, 'shaved tile contains expected number of layers');
    t.equals(shavedTile.length, 176, 'expected tile size after filtering');
    t.end();
  });
});

test('validator: layers successfully shaved, expression', function(t) {
  var buffer = fixtures.get('038').buffer;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==", ["get", "string_value"], "ello"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    if (err) throw err;
    var postTile =  new vt(new pbf(shavedTile));
    t.ok(shavedTile);
    t.equals(Object.keys(postTile.layers).length, 1, 'shaved tile contains expected number of layers');
    t.equals(shavedTile.length, 176, 'expected tile size after filtering');
    t.end();
  });
});

test('validator: layers successfully shaved, expression - getType', function(t) {
  var buffer = fixtures.get('021').buffer;
  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==", ["geometry-type"], "LineString"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    if (err) throw err;
    var postTile =  new vt(new pbf(shavedTile));
    t.ok(shavedTile);
    t.equals(Object.keys(postTile.layers).length, 1, 'shaved tile contains expected number of layers');
    t.equals(shavedTile.length, 56, 'expected tile size after filtering');
    t.end();
  });
});

test('validator: version 2 no name field in Layer', function(t) {
  var buffer = fixtures.get('014').buffer;
  Shaver.shave(buffer, {filters: genericFilter, zoom: 0}, function(err, shavedTile) {
    t.ok(err);
    if (SHOW_ERROR) console.log(err);
    t.end();
  });
});

test('validator: unknown field type in Layer', function(t) {
  var buffer = fixtures.get('016').buffer;

  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==","id","1"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    t.notOk(err);
    t.end();
  });
});

test('validator: version 1 no name', function(t) {
  var buffer = fixtures.get('023').buffer;

  Shaver.shave(buffer, {filters: genericFilter, zoom: 0}, function(err, shavedTile) {
    t.ok(err);
    if (SHOW_ERROR) console.log(err);
    t.end();
  });
});

test('validator: odd number of tags in Feature', function(t) {
  var buffer = fixtures.get('005').buffer;

  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==","string_value","world"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    t.ok(err);
    if (SHOW_ERROR) console.log(err);
    t.end();
  });
});

test('validator: invalid key or value as it does not appear in the layer', function(t) {
  var buffer = fixtures.get('042').buffer;

  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==","string_value","park"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    t.ok(err);
    if (SHOW_ERROR) console.log(err);
    t.end();
  });
});

test('validator: Feature unknown geometry type', function(t) {
  var buffer = fixtures.get('006').buffer;

 var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        "filter": [ "==", "$id", 0 ]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    t.ok(err);
    if (SHOW_ERROR) console.log(err);
    t.end();
  });
});

test('validator: Feature unknown field type type', function(t) {
  var buffer = fixtures.get('041').buffer;

  var filters = new Shaver.Filters(Shaver.styleToFilters({
    layers: [
      {
        "source-layer": "hello",
        filter: ["==","string_value","lake"]
      }
    ]
  }));

  Shaver.shave(buffer, {filters: filters, zoom: 0}, function(err, shavedTile) {
    t.ok(err);
    if (SHOW_ERROR) console.log(err);
    t.end();
  });
});