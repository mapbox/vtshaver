var fs = require('fs');
var path = require('path');
var test = require('tape');
var styleToFilter = require('../lib/styleToFilters.js');
var properties_result_expressions = './fixtures/filters/expressions-properties.json';

test('test get used properites from style.json', function(t) {
  var filters = styleToFilter({
    "metadata": {
      "mapbox:retain": {
        "landuse": ["p6"],
        "water": ["all properties will already be kept so this value does not matter"], // due to the "exp-test0": ["properties"] below
        "test": [true] // will keep everything
      }
    },
    "layers": [{
      "source-layer": "landuse",
      "paint": {
        "exp-test1": ["==", ["get", "p1"], "false"],
        "exp-test1-fake": ["==", ["get", "p1-fake", { "obj": 1 }], "false"],
        "exp-test2": ["==", ["has", "p2"], "false"],
        "exp-test2-fake": ["==", ["has", "p2-fake", { "obj": 1 }], "false"],
        "exp-test3": ["==", ["feature-state", "p3"], "false"],
        "exp-test4": ["feature-state", "p4"],
        "exp-test5": {
          "property": "p5"
        },
      }
    }, {
      "source-layer": "water",
      "paint": {
        "exp-test0": ["properties"],
        "exp-test1": ["==", ["get", "p1"], "false"],
        "exp-test1-fake": ["==", ["get", "p1-fake", { "obj": 1 }], "false"],
        "exp-test2": ["==", ["has", "p2"], "false"],
        "exp-test2-fake": ["==", ["has", "p2-fake", { "obj": 1 }], "false"],
        "exp-test3": ["==", ["feature-state", "p3"], "false"],
        "exp-test4": ["feature-state", "p4"],
      }
    }, {
      "source-layer": "test",
      "paint": {
        "exp-test1": ["==", ["get", "p1"], "false"],
      }
    }]
  });
  //   console.log('xxx', filters);
  if (process.env.UPDATE) {
    console.log('> UPDATING ' + properties_result_expressions);
    fs.writeFileSync(path.resolve(__dirname, properties_result_expressions), JSON.stringify(filters));
  }
  t.deepEquals(filters, require(properties_result_expressions), 'expressions filter is extracted correctly');

  t.end();
});
