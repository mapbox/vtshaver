var fs = require('fs');
var path = require('path');
var test = require('tape');
var styleToFilter = require('../lib/styleToFilters.js');

var brightV9 = require('./fixtures/styles/bright-v9.json');
var floating = require('./fixtures/styles/floating-point-zoom.json');
var style_expressions_legacy = require('./fixtures/styles/expressions-legacy.json');
var filter_result_bright = './fixtures/filters/bright-filter.json';
var filter_result_floating = './fixtures/filters/floating-filter.json';
var filter_result_expressions = './fixtures/filters/expressions-filter.json';

test('error handling', function(t) {
  t.deepEqual(styleToFilter({}), {}, 'returns a plain object when given a plain object');
  t.deepEqual(styleToFilter([]), {}, 'returns a plain object when given an array');
  t.deepEqual(styleToFilter('hello'), {}, 'returns a plain object when given a string');
  t.deepEqual(styleToFilter({layers:[]}), {}, 'returns a plain object when given an empty style layers');
  t.deepEqual(styleToFilter({layers:'lol no layers here'}), {}, 'returns a plain object when given snarky style layers');

  t.end();
});

test('min/max zoom defaults are set if the do not exist', function(t) {
  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water'
      }
    ]
  }), {water: {filters: true, minzoom: 0, maxzoom: 22}}, 'returns water:true for only water layer and includes min/max zoom');
  t.end();
});

test('simple style layers', function(t) {
  t.deepEqual(styleToFilter({layers:[{arbitrary:'layer'}]}), {}, 'skips any layers without source-layer key');
  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water',
        minzoom: 10,
        maxzoom: 15
      }
    ]
  }), {water: {filters: true, minzoom: 10, maxzoom: 15}}, 'returns water:true for only water layer and includes min/max zoom');

  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water',
        filter: ['==','color','blue']
      }
    ]
  }), {water: {filters: ['any',['==','color','blue']], minzoom: 0, maxzoom: 22}}, 'returns water:filter for water layer with filter');

  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water'
      },
      {
        'source-layer':'water',
        filter: ['==','color','blue']
      }
    ]
  }), {water:{filters: true, minzoom: 0, maxzoom: 22}}, 'returns water:filter for multiple water layers, some with filters');

  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water',
        filter: ['!=','color','blue'],
        minzoom: 10,
        maxzoom: 15
      },
      {
        'source-layer':'water',
        filter: ['==','color','blue'],
        minzoom: 8,
        maxzoom: 16
      }
    ]
  }), {water: {filters: ['any',['!=','color','blue'],['==','color','blue']], minzoom: 8, maxzoom: 16}}, 'returns water:filter for multiple water filters, and updates min/max zoom for smallest/largest values');

  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water',
        filter: ['!=','color','blue'],
        minzoom: 10,
        maxzoom: 15
      },
      {
        'source-layer':'water',
        filter: ['==','color','blue']
      }
    ]
  }), {water: {filters: ['any',['!=','color','blue'],['==','color','blue']], minzoom: 0, maxzoom: 22}}, 'returns water:filter for multiple water filters, and updates min/max zoom to 0 and 22 if one filter doesn\'t have zooms');

  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water',
        filter: ['!=','color','blue']
      },
      {
        'source-layer':'water',
        filter: ['==','color','blue']
      }
    ]
  }), {water: {filters: ['any',['!=','color','blue'],['==','color','blue']], minzoom: 0, maxzoom: 22}}, 'returns water:filter for multiple water layers with filters');

  t.deepEqual(styleToFilter({
    layers: [
      {
        'source-layer':'water',
        filter: ['!=','color','blue']
      },
      {
        'source-layer':'landcover',
        filter: ['==','color','blue']
      }
    ]
  }), {water: {filters: ['any',['!=','color','blue']], minzoom: 0, maxzoom: 22},landcover: {filters: ['any',['==','color','blue']], minzoom: 0, maxzoom: 22}}, 'returns right filters for multiple layers with filters');

  t.end();
});

test('real-world style test', function(t) {
  var filters = styleToFilter(brightV9);
  if (process.env.UPDATE) {
    console.log('> UPDATING ' + filter_result_bright);
    fs.writeFileSync(path.resolve(__dirname, filter_result_bright), JSON.stringify(filters));
  }
  t.deepEquals(filters, require(filter_result_bright), 'bright-v9 filter is extracted correctly');

  t.end();
});

test('floating point zoom', function(t) {
  var filters = styleToFilter(floating);
  if (process.env.UPDATE) {
    console.log('> UPDATING ' + filter_result_floating);
    fs.writeFileSync(path.resolve(__dirname, filter_result_floating), JSON.stringify(filters));
  }
  t.deepEquals(filters, require(filter_result_floating), 'floating-point filter is extracted correctly');

  t.end();
});

// Technically will succeed, but will fail later when attempting to create
// a GL Filter object per https://github.com/mapbox/mapbox-gl-native/pull/12065
test('v8 streets style with legacy+expressions filter combo', function(t) {
  var filters = styleToFilter(style_expressions_legacy);
  if (process.env.UPDATE) {
    console.log('> UPDATING ' + filter_result_expressions);
    fs.writeFileSync(path.resolve(__dirname, filter_result_expressions), JSON.stringify(filters));
  }
  t.deepEquals(filters, require(filter_result_expressions), 'expressions filter is extracted correctly');

  t.end();
});