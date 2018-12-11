const https = require('https');

if (!process.env.MapboxStagingToken) {
  console.log('Please pass in env: MapboxStagingToken');
  process.exit(-1);
}

if (!process.env.MapboxStagingHost) {
  console.log('Please pass in env: MapboxStagingHost');
  process.exit(-1);
}

if (!process.env.MapboxAccessToken) {
  console.log('Please pass in env: MapboxAccessToken');
  process.exit(-1);
}

if (!process.env.PlotlyUser) {
  console.log('Please pass in env: PlotlyUser');
  process.exit(-1);
}

if (!process.env.PlotlyApiKey) {
  console.log('Please pass in env: PlotlyApiKey');
  process.exit(-1);
}

let stagingToken = process.env.MapboxStagingToken
let stagingHost = process.env.MapboxStagingHost
let productionToken = process.env.MapboxAccessToken
let productionHost = 'api.mapbox.com'

var plotly = require('plotly')(process.env.PlotlyUser, process.env.PlotlyApiKey);

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

        let stagingOrigin = 0;
        let productionOptimize = 0;
        let stagingOptimize = 0;

        console.log(z, cX, cY);
        async function getSize() {
          stagingOrigin = await getTileSize(z, cX, cY, null, stagingToken, stagingHost);
          productionOptimize = await getTileSize(z, cX, cY, 'streets-v10', productionToken, productionHost);
          stagingOptimize = await getTileSize(z, cX, cY, 'streets-v10', stagingToken, stagingHost);
          if (stagingOrigin < 100 || productionOptimize < 100 || stagingOptimize < 100) {
            console.log('\tbad request abandon re-get');
            await getSize();
          }
        }
        await getSize();

        let table = '\tOrigin\told\tnew'
        table += `\n\t${stagingOrigin}\t${productionOptimize}(${((productionOptimize-stagingOrigin)/stagingOrigin*100).toFixed(2)}%)\t${stagingOptimize}(${((stagingOptimize-stagingOrigin)/stagingOrigin*100).toFixed(2)}%)`

        // else {
        count++;
        levelOriginCount += Number(stagingOrigin);
        levelStreetsCount += Number(productionOptimize);
        levelLightCount += Number(stagingOptimize);
        // }
        console.log(table);


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
  // console.log(host);
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
