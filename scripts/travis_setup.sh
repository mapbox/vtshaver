#!/usr/bin/env bash

set -eu
set -o pipefail

MASON_VERSION="master"

function setup_mason() {
    if [[ ! -d ./.mason ]]; then
        git clone https://github.com/mapbox/mason.git ./.mason
        (cd ./.mason && git checkout ${MASON_VERSION})
    else
        echo "Updating to latest mason"
        (cd ./.mason && git fetch && git checkout ${MASON_VERSION})
    fi
    export PATH=$(pwd)/.mason:$PATH
}

function init_binary() {
    mason install ${1} ${2}
    export PATH=$(mason prefix ${1} ${2})/bin:${PATH}

}

function main() {
    setup_mason
    if [[ $(uname -s) == 'Linux' ]]; then
        init_binary clang++ 3.9.1
        init_binary llvm-cov 3.9.1
        export CXX=clang++
        export CC=clang
    fi
}

main

# set back to non-strict bash mode to avoid breaking travis itself
set +eu
set +o pipefail

