var fs = require('fs');
const mbgl = require('../tools/.fxitures/mbgl');


function render(tile, config) {
  const Map = new mbgl.Map({ ratio: 1, mode: 'tile' });
  let assets = {};

  let URLS = [
    'mapbox://mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7',
    'mapbox://sprites/mapbox/streets-v9.json',
    'mapbox://sprites/mapbox/streets-v9.png',
    `mapbox:///mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/16/10465/25329.vector.pbf`,
    'mapbox://fonts/mapbox/DIN%20Offc%20Pro%20Medium%2cArial%20Unicode%20MS%20Regular/0-255.pbf',
    'mapbox://fonts/mapbox/DIN%20Offc%20Pro%20Regular%2cArial%20Unicode%20MS%20Regular/0-255.pbf',
    'mapbox://fonts/mapbox/DIN%20Offc%20Pro%20Bold%2cArial%20Unicode%20MS%20Bold/0-255.pbf'
  ];
  for (let i in URLS) {
    let file;
    if (URLS[i] === 'mapbox:///mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/16/10465/25329.vector.pbf') {
      file = fs.readFileSync(tile);
    } else {
      file = fs.readFileSync(`./test/tools/.fxitures/${URLS[i].replace('//', '@').split('/').join('&')}`);
    }
    assets[URLS[i]] = file;
  }
  Map.render(
    JSON.parse(fs.readFileSync(config.style)),
    assets, {
      zoom: config.zoom,
      width: 256,
      height: 256,
      center: config.center,
      ratio: 1,
      pitch: 0,
      bearing: 0
    },
    function(data) {
      const url = `./test/tools/.cache/${encodeURIComponent(tile)}.png`;
      fs.writeFileSync(url, data);
      console.log('great success tiles save to ', url);
    }
  );
}


/**
 * getImg
 * @param {String} tiles1 // the 1st tile's path
 * @param {Object} config // config of the tile
 * {
 *      zoom: 16, 
 *      center: [-122.511291, 37.781569],
 *      styles: '/xx.json'
 * }
 */
exports.getImg = render;