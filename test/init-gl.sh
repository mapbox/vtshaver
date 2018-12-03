rm -rf ./test/tmp;
git clone --single-branch -b mbgl-api-gl --depth=1  git@github.com:mapbox/gl-internal.git ./test/tmp/gl-internal;
cd ./test/tmp/gl-internal;
make node;