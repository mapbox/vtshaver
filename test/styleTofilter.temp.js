var Shaver = require('../');
var fs = require('fs');

// console.log()
var filter_obj = Shaver.styleToFilters(JSON.parse(fs.readFileSync('./test/fixtures/styles/expressions.json').toString()));
// console.log(JSON.stringify(filter_obj, '', 4))