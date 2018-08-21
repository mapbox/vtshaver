...

[![Build Status](https://travis-ci.com/mapbox/vtshaver.svg?branch=master)](https://travis-ci.com/mapbox/vtshaver)
[![codecov](https://codecov.io/gh/mapbox/vtshaver/branch/master/graph/badge.svg)](https://codecov.io/gh/mapbox/vtshaver)
[![badge](https://mapbox.s3.amazonaws.com/cpp-assets/node-cpp-skel-badge_blue.svg)](https://github.com/mapbox/node-cpp-skel)


# Installation

Each `make` command is specified in [`Makefile`](./Makefile)

```bash
git clone git@github.com:mapbox/node-cpp-skel.git
cd node-cpp-skel

# Build binaries. This looks to see if there were changes in the C++ code. This does not reinstall deps.
make

# Run tests
make test

# Cleans your current builds and removes potential cache
make clean

# Cleans everything, including the things you download from the network in order to compile (ex: npm packages).
# This is useful if you want to nuke everything and start from scratch.
# For example, it's super useful for making sure everything works for Travis, production, someone else's machine, etc
make distclean

# This skel uses documentation.js to auto-generate API docs.
# If you'd like to generate docs for your code, you'll need to install documentation.js,
# and then add your subdirectory to the docs command in package.json
npm install -g documentation@4.0.0
npm run docs
```

NOTE: we are pinned to `documentation@4.0.0` because 5.x removed C++ support: https://github.com/documentationjs/documentation/blob/master/CHANGELOG.md#500-2017-07-27

### Customizing the compiler toolchain

By default we use `clang++` via [mason](https://github.com/mapbox/mason). The reason we do this is:

 - We want to run the latest and greatest compiler version, to catch the most bugs, provide the best developer experience, and trigger the most helpful warnings
 - We use clang-format to format the code and each version of clang-format formats code slightly differently. To avoid friction around this (and ensure all devs format the code the same) we default to using the same version of clang++ via mason.
 - We want to support [LTO](https://github.com/mapbox/cpp/blob/master/glossary.md#link-time-optimization) in the builds, which is difficult to do on linux unless you control the toolchain tightly.

The version of the clang++ binary (and related tools) is controlled by the [`mason-versions.ini`](./mason-versions.ini), and uses `mason-js` uses to install the toolchain.

All that said, it is still absolutely possible and encouraged to compile your module with another compiler toolchain. In fact we hope that modules based on node-cpp-skel do this!

To customize the toolchain you can override the defaults by setting these environment variables: CXX, CC, LINK, AR, NM. For example to use g++-6 you could do:


```bash
export CXX="g++-6"
export CC="gcc-6"
export LINK="g++-6"
export AR="ar"
export NM="nm"
make
```

These environment variables will override the compiler toolchain defaults in `make_global_settings` in the [`binding.gyp`](./binding.gyp).


### Warnings as errors

By default the build errors on compiler warnings. To disable this do:

```
WERROR=false make
```

### Sanitizers

You can run the [sanitizers](https://github.com/mapbox/cpp/blob/master/glossary.md#sanitizers), to catch additional bugs, by doing:

```shell
make sanitize
```

The sanitizers [are part of the compiler](https://github.com/mapbox/cpp/blob/master/glossary.md#sanitizers) and are also run in a specific job on Travis.


# Code coverage

Code coverage is critical for knowing how well your tests actually test all your code. To see code coverage you can view current results online at [![codecov](https://codecov.io/gh/mapbox/node-cpp-skel/branch/master/graph/badge.svg)](https://codecov.io/gh/mapbox/node-cpp-skel) or you can build in a customized way and display coverage locally like:

```
make coverage
```

**Note**

Use [`// LCOV_EXCL_START` and `// LCOV_EXCL_STOP`](https://github.com/mapbox/vtvalidate/blob/master/src/vtvalidate.cpp#L70-L73) to ignore from [codecov](https://codecov.io/gh/mapbox/node-cpp-skel) _remotely_. However, this won't ignore when running coverage _locally_.

For more details about what `make coverage` is doing under the hood see https://github.com/mapbox/cpp#code-coverage.

