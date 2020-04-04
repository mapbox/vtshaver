# This file inherits default targets for Node addons, see https://github.com/nodejs/node-gyp/blob/master/addon.gypi
{
  # https://github.com/springmeyer/gyp/blob/master/test/make_global_settings/wrapper/wrapper.gyp
  'make_global_settings': [
    ['CXX', '<(module_root_dir)/mason_packages/.link/bin/clang++'],
    ['CC', '<(module_root_dir)/mason_packages/.link/bin/clang'],
    ['LINK', '<(module_root_dir)/mason_packages/.link/bin/clang++'],
    ['AR', '<(module_root_dir)/mason_packages/.link/bin/llvm-ar'],
    ['NM', '<(module_root_dir)/mason_packages/.link/bin/llvm-nm']
  ],
  'includes': [ 'common.gypi' ],
  'variables': { # custom variables we use specific to this file
      'error_on_warnings%':'true', # can be overriden by a command line variable because of the % sign using "WERROR" (defined in Makefile)
      # Use this variable to silence warnings from mason dependencies and from NAN
      # It's a variable to make easy to pass to
      # cflags (linux) and xcode (mac)
      'system_includes': [
        "-isystem <(module_root_dir)/<!(node -e \"require('nan')\")",
        "-isystem <(module_root_dir)/mason_packages/.link/include",
        "-isystem <(module_root_dir)/mason_packages/.link/include/mbgl/vendor/mapbox-base/deps/variant/include",
        "-isystem <(module_root_dir)/mason_packages/.link/include/mbgl/vendor/mapbox-base/deps/optional",
        "-isystem <(module_root_dir)/mason_packages/.link/include/mbgl/vendor/mapbox-base/include",
        "-isystem <(module_root_dir)/mason_packages/.link/include/mbgl/vendor//mapbox-base/deps/geometry.hpp/include",
        "-isystem <(module_root_dir)/mason_packages/.link/include/mbgl/vendor//mapbox-base/deps/geojson.hpp/include",
        '-isystem <(module_root_dir)/mason_packages/.link/include/mbgl/vendor/wagyu/include',
        "-isystem <(module_root_dir)/mason_packages/.link/src",
        "-isystem <(module_root_dir)/mason_packages/.link/platform",
      ],
      # Flags we pass to the compiler to ensure the compiler
      # warns us about potentially buggy or dangerous code
      'compiler_checks': [
        '-Wall',
        '-Wextra',
        '-Weffc++',
        '-Wconversion',
        '-pedantic-errors',
        '-Wconversion',
        '-Wshadow',
        '-Wfloat-equal',
        '-Wuninitialized',
        '-Wunreachable-code',
        '-Wold-style-cast',
        '-Wno-error=unused-variable',
        '-Wno-error=unused-value',
        '-DRAPIDJSON_HAS_STDSTRING=1',
        '-Wno-deprecated-declarations'
      ]
  },
  'targets': [
{
      'target_name': 'action_before_build',
      'type': 'none',
      'hard_dependency': 1,
      'actions': [
        {
          'action_name': 'install_deps',
          'inputs': ['./node_modules/.bin/mason-js'],
          'outputs': ['./mason_packages'],
          'action': ['./node_modules/.bin/mason-js', 'install']
        },
        {
          'action_name': 'link_deps',
          'inputs': ['./node_modules/.bin/mason-js'],
          'outputs': ['./mason_packages/.link'],
          'action': ['./node_modules/.bin/mason-js', 'link']
        }
      ]
    },
    {
      'target_name': '<(module_name)',
      'dependencies': [ 'action_before_build' ],
      'product_dir': '<(module_path)',
      'defines': [
        # we set protozero_assert to avoid the tests asserting
        # since we test they throw instead
        'protozero_assert(x)'
      ],
      'sources': [
        './src/vtshaver.cpp',
        './src/shave.cpp',
        './src/filters.cpp',
        './mason_packages/osx-x86_64/mbgl-core/1.5.1/src/mbgl/tile/geometry_tile_data.cpp'
      ],
      "libraries": [
      # static linking (combining): Take a lib and smoosh it into the thing you're building.
      # A portable file extension name. Build static lib (.a) then when you're linking,
      # you're smooshing it into your lib. Static lib is linked when we build a project, rather than at runtime.
      # But Dynamic lib is loaded at runtime. (.node is a type of dynamic lib cause it's loaded into node at runtime)
           "<(module_root_dir)/mason_packages/.link/lib/libmbgl-core.a"
      ],
      'conditions': [
        ['error_on_warnings == "true"', {
            'cflags_cc' : [ '-Werror' ],
            'xcode_settings': {
              'OTHER_CPLUSPLUSFLAGS': [ '-Werror' ],
              'OTHER_LDFLAGS': ['-framework Foundation']
            }
        }]
      ],
      # Add to cpp glossary (or other doc in cpp repo) different types of binaries (.node, .a, static, dynamic (.so on linux and .dylib on osx))
      # talk from cppcon by person from Apple, exploration of every builds systems in c++ are awful since theyre system-specific
      'cflags': [
          '<@(system_includes)',
          '<@(compiler_checks)'
      ],
      'xcode_settings': {
        'OTHER_LDFLAGS':[
          '-framework Foundation'
        ],
        'OTHER_CPLUSPLUSFLAGS': [
            '<@(system_includes)',
            '<@(compiler_checks)'
        ],
        'GCC_ENABLE_CPP_RTTI': 'YES',
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
        'MACOSX_DEPLOYMENT_TARGET':'10.11',
        'CLANG_CXX_LIBRARY': 'libc++',
        'CLANG_CXX_LANGUAGE_STANDARD':'c++14',
        'GCC_VERSION': 'com.apple.compilers.llvm.clang.1_0'
      }

    }
  ]
}
