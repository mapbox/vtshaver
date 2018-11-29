var fs = require('fs');
const mbgl = require('../tools/.fxitures/mbgl');


function render(tile, config) {
  const Map = new mbgl.Map({ ratio: 1, mode: 'tile' });
  let assets = {};

  let URLS = [
    'mapbox://mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7',
    'mapbox://sprites/mapbox/streets-v9.json',
    'mapbox://sprites/mapbox/streets-v9.png',
    `mapbox:///mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/${tile}`,
    'mapbox://fonts/mapbox/DIN%20Offc%20Pro%20Medium%2cArial%20Unicode%20MS%20Regular/0-255.pbf',
    'mapbox://fonts/mapbox/DIN%20Offc%20Pro%20Regular%2cArial%20Unicode%20MS%20Regular/0-255.pbf',
    'mapbox://fonts/mapbox/DIN%20Offc%20Pro%20Bold%2cArial%20Unicode%20MS%20Bold/0-255.pbf'
  ];
  for (let i in URLS) {
    assets[URLS[i]] = fs.readFileSync(`./test/tools/.fxitures/${URLS[i].replace('//', '@').split('/').join('&')}`);
  }
  Map.render(
    JSON.parse(fs.readFileSync(`./test/tools/.fxitures/style.json`)),
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
 * 
 * @param {String} tiles1 // the 1st tile's url
 * @param {String} tiles2 // the 2ed tile's url
 * @param {Object} config // config of the tile
 * {
 *      zoom: 16, 
 *      center: [-122.511291, 37.781569],
 * }
 */
function compare(tiles1, tiles2, config) {
  render(tiles1, config);
  render(tiles2, config);
}

compare(
  '16/10465/25329.vector.pbf',
  '16/10465/25329.vector.pbf', {
    zoom: 16,
    center: [-122.511291, 37.781569],
  }
)