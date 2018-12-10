const https = require('https');

let stagingToken = 'pk.eyJ1Ijoic3ByaW5nbWV5ZXItc3RhZ2luZyIsImEiOiJjajJnaTU5NTAwMDFoMzJtbWQxc29zaThmIn0.N2GJ6F8oOJpbVDoABkhpHQ';
let stagingHost = 'cloudfront-staging.tilestream.net';
let productionToken = 'pk.eyJ1Ijoiemh1d2VubG9uZyIsImEiOiJjaW15ejRweHAwNDh3dmxtNGdhZHJwc2VoIn0.XkqHtTtuAOaol5QliCSNyg';
let productionHost = 'api.mapbox.com'

var plotly = require('plotly')('zmofei', 'I9TLFZPyCfewvP8frKdz');

const center = [121.49677, 31.23585];
const step = 1;
var stagingOriginData = {
  x: [],
  y: [],
  type: 'bar',
  name: 'stagingOriginData'
}
var productionOptimizeData = {
  x: [],
  y: [],
  type: 'bar',
  name: 'productionOptimizeData'
}
var stagingOptimizeData = {
  x: [],
  y: [],
  type: 'bar',
  name: 'stagingOptimizeData'
}

//
async function getAllTheTiles() {
  for (let z = 5; z <= 16; z++) {
    let centerTile = pointToTileFraction(center[0], center[1], z);
    const x = Math.round(centerTile[0]);
    const y = Math.round(centerTile[1]);
    const xMin = x - step;
    const xMax = x + step;
    const yMin = y - step;
    const yMax = y + step;
    let levelOriginCount = 0;
    let levelStreetsCount = 0;
    let levelLightCount = 0;

    let cX = xMin;
    let count = 0;
    while (cX <= xMax) {
      let cY = yMin;
      while (cY <= yMax) {
        cY += 1;
        count++;
        let stagingOrigin = await getTileSize(z, cX, cY, null, stagingToken, stagingHost);
        let productionOptimize = await getTileSize(z, cX, cY, 'streets-v10', productionToken, productionHost);
        let stagingOptimize = await getTileSize(z, cX, cY, 'streets-v10', stagingToken, stagingHost);
        console.log(z, cX, cY);
        console.log(stagingOrigin, productionOptimize, stagingOptimize);
        levelOriginCount += Number(stagingOrigin);
        levelStreetsCount += Number(productionOptimize);
        levelLightCount += Number(stagingOptimize);

      }
      cX += 1;
    }
    stagingOriginData.x.push(z);
    stagingOriginData.y.push(levelOriginCount / count);
    productionOptimizeData.x.push(z);
    productionOptimizeData.y.push(levelStreetsCount / count)
    stagingOptimizeData.x.push(z);
    stagingOptimizeData.y.push(levelLightCount / count)
  }

  plotly.plot([stagingOriginData, productionOptimizeData, stagingOptimizeData], {
    fileopt: "overwrite",
    filename: "vt-shaver",
  }, function(err, msg) {
    console.log(msg);
  });
}

// get the tiles size 
async function getTileSize(z, x, y, style, access_token, host) {
  console.log(host);
  let path = `/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/${z}/${x}/${y}.vector.pbf?access_token=${access_token}`;
  if (style) {
    path += `&style=mapbox://styles/mapbox/${style}@0`;
  }

  const options = {
    hostname: host,
    port: 443,
    path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
      "Accept-Encoding": "gzip, deflate, br"
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let length = res.headers['content-length'];
      resolve(length);
    });

    req.on('error', (e) => {
      console.error(e);
    });

    req.end();
  })
}

/**
 * Get the precise fractional tile location for a point at a zoom level
 * from  https://github.com/mapbox/tilebelt/blob/master/index.js
 *
 * @name pointToTileFraction
 * @param {number} lon
 * @param {number} lat
 * @param {number} z
 * @returns {Array<number>} tile fraction
 * var tile = pointToTileFraction(30.5, 50.5, 15)
 * //=tile
 */
function pointToTileFraction(lon, lat, z) {
  var d2r = Math.PI / 180,
    r2d = 180 / Math.PI;
  var sin = Math.sin(lat * d2r),
    z2 = Math.pow(2, z),
    x = z2 * (lon / 360 + 0.5),
    y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);

  // Wrap Tile X
  x = x % z2
  if (x < 0) x = x + z2
  return [x, y, z];
}



getAllTheTiles();