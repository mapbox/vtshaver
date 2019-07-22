#include "shave.hpp"
#include "filters.hpp"

#include <cmath>
#include <exception>
#include <gzip/compress.hpp>
#include <gzip/decompress.hpp>
#include <gzip/utils.hpp>
#include <iostream>
#include <map>
#include <mapbox/vector_tile.hpp>
#include <mbgl/style/conversion.hpp>
#include <mbgl/style/conversion/filter.hpp>
#include <mbgl/style/filter.hpp>
#include <mbgl/tile/geometry_tile_data.hpp>
#include <node/src/node_conversion.hpp>

#include <tuple>
#include <utility>

#include <vtzero/builder.hpp>
#include <vtzero/index.hpp>
#include <vtzero/property_mapper.hpp>
#include <vtzero/vector_tile.hpp>

static void CallbackError(const std::string& message, v8::Local<v8::Function> callback) {
    v8::Local<v8::Value> argv[1] = {Nan::Error(message.c_str())};
    Nan::MakeCallback(Nan::GetCurrentContext()->Global(), callback, 1, static_cast<v8::Local<v8::Value>*>(argv));
}

class AsyncBaton {
  public:
    uv_work_t request{};                // required
    Nan::Persistent<v8::Function> cb{}; // callback function type (will stay alive until you say it can be destroyed)
    std::string error_name{};
    std::string result{};

    /******* BUFFER *******/
    Nan::Persistent<v8::Object> buffer{}; // Persistent: hey v8, dont destroy this
    const char* data{};                   // * --> pointer...C string (array of chars)
    std::size_t dataLength{};             // using "std" namespace is best-practice
    std::unique_ptr<std::string> shaved_tile{};

    /******* ZOOMS *******/
    float zoom{};
    optional<float> maxzoom{};

    /******* whether to compress *******/
    bool compress = false;

    /******* FILTER  *******/
    Filters* filters_obj{};
};

/**
 * Shave off unneeded layers and features, asynchronously
 *
 * @name shave
 * @param {Buffer} buffer - Vector Tile PBF
 * @param {Object} [options={}]
 * @param {Number} [options.zoom]
 * @param {Number} [options.maxzoom]
 * @param {Object} [options.compress]
 * @param {String} options.compress.type output a compressed shaved ['none'|'gzip']
 * @param {Function} callback - from whence the shaven vector tile comes
 * @example
 * var shaver = require('@mapbox/vtshaver');
 * var fs = require('fs');
 * var buffer = fs.readFileSync('/path/to/vector-tile.mvt');
 * var style = require('/path/to/style.json');
 * var filters = new shaver.Filters(shaver.styleToFilters(style));
 * 
 * var options = {
 *     filters: filters,  // required
 *     zoom: 14,          // required
 *     maxzoom: 16,       // optional
 *     compress: {        // optional
 *         type: 'none'
 *     }
 * };
 * 
 * shaver.shave(buffer, options, function(err, shavedTile) {
 *     if (err) throw err;
 *     console.log(shavedTile); // => vector tile buffer
 * });
 */
NAN_METHOD(shave) {
    // CALLBACK: ensure callback is a function
    v8::Local<v8::Value> callback_val = info[info.Length() - 1];
    if (!callback_val->IsFunction() || callback_val->IsNull() || callback_val->IsUndefined()) {
        Nan::ThrowError("last argument must be a callback function");
        return;
    }
    v8::Local<v8::Function> callback = callback_val.As<v8::Function>();

    // BUFFER: check first argument, should be a pbf object
    v8::Local<v8::Value> buffer_val = info[0];
    if (!buffer_val->IsObject() || !node::Buffer::HasInstance(buffer_val) || buffer_val->IsNull() || buffer_val->IsUndefined()) {
        CallbackError("first arg 'buffer' must be a Protobuf buffer object", callback);
        return;
    }
    auto buffer = buffer_val->ToObject();

    // OPTIONS: check second argument, should be an 'options' object
    v8::Local<v8::Value> options_val = info[1];
    if (!options_val->IsObject() || options_val->IsNull() || options_val->IsUndefined()) {
        CallbackError("second arg 'options' must be an object", callback);
        return;
    }
    auto options = options_val.As<v8::Object>();

    // check zoom, should be a number
    uint32_t zoom;
    if (!options->Has(Nan::New("zoom").ToLocalChecked())) {
        CallbackError("option 'zoom' not provided. Please provide a zoom level for this tile.", callback);
        return;
    }

    v8::Local<v8::Value> zoom_val = options->Get(Nan::New("zoom").ToLocalChecked());
    if (!zoom_val->IsUint32()) {
        CallbackError("option 'zoom' must be a positive integer.", callback);
        return;
    }

    zoom = zoom_val->Uint32Value();

    // check maxzoom, should be a number
    optional<uint32_t> maxzoom;
    if (options->Has(Nan::New("maxzoom").ToLocalChecked())) {
        // Validate optional "maxzoom" value
        v8::Local<v8::Value> maxzoom_val = options->Get(Nan::New("maxzoom").ToLocalChecked());
        if (!maxzoom_val->IsUint32()) {
            CallbackError("option 'maxzoom' must be a positive integer.", callback);
            return;
        }
        maxzoom = maxzoom_val->Uint32Value();
    }

    // validate compress (OPTIONAL)
    bool compress = false;
    if (options->Has(Nan::New("compress").ToLocalChecked())) {
        v8::Local<v8::Value> compress_options_val = options->Get(Nan::New("compress").ToLocalChecked());
        v8::Local<v8::Object> compress_options = compress_options_val.As<v8::Object>();

        // compress.type is REQUIRED
        if (!compress_options->Has(Nan::New("type").ToLocalChecked())) {
            CallbackError("compress option 'type' not provided. Please provide a compression type if using the compress option", callback);
            return;
        }

        v8::Local<v8::Value> compress_type = compress_options->Get(Nan::New("type").ToLocalChecked());

        if (!compress_type->IsString()) {
            CallbackError("compress option 'type' must be a string", callback);
            return;
        }

        // Convert from v8 Object to std::string so we can check compress type value
        Nan::Utf8String utf8str(compress_type);
        std::string str(*utf8str);

        // compress.type can only be 'none' and 'gzip' for now
        if (str != "none" && str != "gzip") {
            CallbackError("compress type must equal 'none' or 'gzip'", callback);
            return;
        }
        if (str == "gzip") {
            compress = true;
        }

        // compress.level is OPTIONAL
        if (compress_options->Has(Nan::New("level").ToLocalChecked())) {
            v8::Local<v8::Value> compress_level = compress_options->Get(Nan::New("level").ToLocalChecked());
            if (!compress_level->IsUint32()) {
                CallbackError("compress option 'level' must be an unsigned integer", callback);
                return;
            }
        }
    }

    // `filters` comes in as a shaver.Filters object
    if (options->Has(Nan::New("filters").ToLocalChecked())) {
        v8::Local<v8::Value> filters_val = options->Get(Nan::New("filters").ToLocalChecked());

        // options.filters will now be an Object
        if (filters_val->IsNull() ||
            filters_val->IsUndefined() ||
            !filters_val->IsObject()) {
            CallbackError(
                "option 'filters' must be a shaver.Filters object",
                callback);
            return;
        }

        v8::Local<v8::Object> filters_object = filters_val->ToObject();

        // This is the same as calling InstanceOf() in JS-world
        if (!Nan::New(Filters::constructor())->HasInstance(filters_object)) {
            CallbackError(
                "option 'filters' must be a shaver.Filters object",
                callback);
            return;
        }

        // set up the baton to pass into our threadpool
        auto* baton = new AsyncBaton(); // NOLINT since we're in the process of refactoring to remove AsyncBaton and use Nan::AysncWorker
        baton->request.data = baton;
        baton->data = node::Buffer::Data(buffer);
        baton->dataLength = node::Buffer::Length(buffer);
        baton->shaved_tile = std::make_unique<std::string>();
        // we convert to float here since comparison is against
        // floating point value as styles support fractional zooms
        baton->zoom = static_cast<float>(zoom);
        baton->maxzoom = maxzoom ? static_cast<float>(*maxzoom) : optional<float>();
        baton->compress = compress;
        // TODO(alliecrevier): pass compress_type and compress_level once we add support for more than gzip with default level: https://github.com/mapbox/gzip-hpp/blob/832d6262cecaa3b85c3c242e3617b4cfdbf3de23/include/gzip/compress.hpp#L19
        baton->filters_obj = Nan::ObjectWrap::Unwrap<Filters>(filters_object); // "Unwrap" takes the Javascript object and gives us the C++ object (gets rid of JS wrapper)
        baton->filters_obj->_ref();                                            // This is saying "I'm in use, don't garbage collect me"
        baton->buffer.Reset(buffer.As<v8::Object>());
        baton->cb.Reset(callback);
        uv_queue_work(uv_default_loop(), &baton->request, AsyncShave, reinterpret_cast<uv_after_work_cb>(AfterShave));
    } else {
        CallbackError("must create a filters object using Shaver.Filters() and pass filters in to Shaver.shave", callback);
        return;
    }
}

// We use a std::vector here over std::map and std::unordered_map
// because benchmarking showed that it is faster to create many of them
// when there are only a few items inside. And also reasonably fast to search
// them linearly when only a few items are inside. If vector tiles with 100s
// of properties were the rule then a std::unordered_map might be faster again.
using properties_type = std::vector<vtzero::property>;

// This mapping struct is a clever way to convert float to double, since geometry.hpp variant type does not include float type value
// per https://github.com/mapbox/geometry.hpp/blob/b0e41cc5635ff8d50e7e1edb73cadf1d2a7ddc83/include/mapbox/geometry/feature.hpp#L35-L37
// So this mapping converts every use of "float_type" inside of vtzero::convert_property_value to a double type.
struct mapping : vtzero::property_value_mapping {
    using float_type = double; // no float in variant, so convert to double
};

class VTZeroGeometryTileFeature : public mbgl::GeometryTileFeature {
    vtzero::feature const& feature_;
    mbgl::FeatureType ftype_;

  public:
    VTZeroGeometryTileFeature(vtzero::feature const& feature, mbgl::FeatureType ftype)
        : feature_(feature),
          ftype_(ftype) {
    }

    mbgl::FeatureType getType() const override {
        return ftype_;
    }

    mbgl::optional<mbgl::FeatureIdentifier> getID() const override {
        if (feature_.has_id()) {
            return {feature_.id()}; // Brackets create empty optional type
        }
        return mbgl::optional<mbgl::FeatureIdentifier>{};
    }

    std::unordered_map<std::string, mbgl::Value> getProperties() const override {
        std::unordered_map<std::string, mbgl::Value> map;

        feature_.for_each_property([&](const vtzero::property& prop) {
            map.emplace(std::string(prop.key()), vtzero::convert_property_value<mapbox::geometry::value, mapping>(prop.value()));
            return true;
        });

        return map;
    }

    mbgl::optional<mbgl::Value> getValue(const std::string& key) const override {
        mbgl::optional<mbgl::Value> obj;

        // If any of the property keys match the Filter key, we will keep the feature AND all of its properties.
        // Therefore, we are not yet filtering properties. This is a TODO
        feature_.for_each_property([&](vtzero::property&& prop) {
            // We are comparing data_views to avoid needing to allocate memory for the comparison if we were to compare strings instead.
            if (key == prop.key()) {
                obj = vtzero::convert_property_value<mapbox::geometry::value, mapping>(prop.value());
                return false;
            }
            return true;
        });

        return obj;
    }

    mbgl::GeometryCollection getGeometries() const override {
        // LCOV_EXCL_START
        return {};
        // LCOV_EXCL_STOP
    }
};

static bool evaluate(mbgl::style::Filter const& filter,
                     float minzoom,
                     float maxzoom,
                     mbgl::FeatureType ftype,
                     vtzero::feature const& feature) // This properties arg is our custom type that we use in our lambda function below.
{
    VTZeroGeometryTileFeature geomfeature(feature, ftype);

    for(int zoom = std::floor(minzoom); zoom <= std::ceil(maxzoom); zoom++) {
        // std::string const& key is dynamic and comes from the Filter object
        mbgl::style::expression::EvaluationContext context(zoom, &geomfeature);
        bool result = filter(context);
        if (result) return result;
    }
    return false;
}

static mbgl::FeatureType convertGeom(vtzero::GeomType geometry_type) {
    // Convert vtzero::geometry type to mbgl::FeatureType for the evaluate() function
    switch (geometry_type) {
    case vtzero::GeomType::POINT:
        return mbgl::FeatureType::Point;
    case vtzero::GeomType::LINESTRING:
        return mbgl::FeatureType::LineString;
    case vtzero::GeomType::POLYGON:
        return mbgl::FeatureType::Polygon;
    default:
        // Vector tile has an unknown geometry type, so skip and dont include it in the final shaved VT
        return mbgl::FeatureType::Unknown;
    }
}

void filterFeatures(vtzero::tile_builder* finalvt,
                    float minzoom,
                    float maxzoom,
                    vtzero::layer const& layer,
                    mbgl::style::Filter const& mbgl_filter_obj,
                    Filters::filter_properties_type const& property_filter) {
    /**
    * TODOs:
    * - Instead of decoding/re-encoding, we'll want to add bytes...?
    * - Look into vtzero for when it adds name, version, extent, etc, to get a sense if it's doing any unnecessary work, in case we end up not needing any features within this layer
    * - Filter out keys/values based on filter results below. Currently we need to add them to the new layer to have a complete layer, just like name, version, extent. For each key, add it back (no filtering for now)
    **/
    vtzero::layer_builder layer_builder{*finalvt, layer};
    vtzero::property_mapper mapper{layer, layer_builder};

    Filters::filter_properties_types const& property_filter_type = property_filter.first;
    std::vector<std::string> const& properties = property_filter.second;

    auto const& keytable = layer.key_table();
    std::vector<std::ptrdiff_t> props_by_index;
    for (auto const& prop : properties) {
        auto itr = std::find(keytable.begin(), keytable.end(), prop);
        if (itr != keytable.end()) {
            props_by_index.emplace_back(std::distance(keytable.begin(), itr));
        }
    }

    bool needAllProperties = property_filter_type == Filters::filter_properties_types::all;

    layer.for_each_feature([&](vtzero::feature&& feature) {
        mbgl::FeatureType geometry_type = convertGeom(feature.geometry_type());

        if (geometry_type == mbgl::FeatureType::Unknown) {
            return true; // skip to next feature
        }

        // If evaluate() returns true, this feature includes properties that are relevant to the filter.
        // So we add the feature to the final layer.
        if (evaluate(mbgl_filter_obj, minzoom, maxzoom, geometry_type, feature)) {
            vtzero::geometry_feature_builder feature_builder{layer_builder};
            if (feature.has_id()) {
                feature_builder.set_id(feature.id());
            }
            feature_builder.set_geometry(feature.geometry());

            while (auto idxs = feature.next_property_indexes()) {
                if (!needAllProperties) {
                    // get the key only if we don't need all the properties;
                    // if the key is not in the properties list, skip to add to feature
                    if (std::find(props_by_index.begin(), props_by_index.end(), idxs.key()) == props_by_index.end()) {
                        continue;
                    }
                }
                // only if we want all the properties or the key in the properties list we add this property to feature
                feature_builder.add_property(mapper(idxs));
            }
            feature_builder.commit();
        }

        return true;
    });
}

// This is where we actually shave
void AsyncShave(uv_work_t* req) {
    auto* baton = static_cast<AsyncBaton*>(req->data);    // NOLINT since we're in the process of refactoring to remove AsyncBaton and use Nan::AysncWorker
    vtzero::data_view dv{baton->data, baton->dataLength}; // Read input data
    std::string uncompressed;

    try {

        if (gzip::is_compressed(baton->data, baton->dataLength)) {
            // Decompress tile before reading data
            gzip::Decompressor decompressor;
            decompressor.decompress(uncompressed, baton->data, baton->dataLength);
            dv = vtzero::data_view(uncompressed);
        }

        vtzero::vector_tile vt{dv}; // Needed for reading the tile
        vtzero::tile_builder finalvt;

        auto const& active_filters = baton->filters_obj->get_filters();
        while (auto layer = vt.next_layer()) {
            // Check if layer is empty (TODO: or invalid)
            if (layer.empty()) {
                continue;
            }

            // Using https://github.com/mapbox/protozero/blob/master/include/protozero/data_view.hpp#L129 to convert data_view to string
            auto filter_itr = active_filters.find(std::string{layer.name()}); // TODO(carol): Convert filter_key_type to data_view, in src/filters.hpp

            // If the filter is found for this layer name, continue to filter features within this layer
            if (filter_itr != active_filters.end()) {
                auto const& filter = filter_itr->second;

                // get info from tuple
                auto const& mbgl_filter_obj = std::get<0>(filter);
                auto const& property_filter = std::get<1>(filter);
                auto const minzoom = std::get<2>(filter);
                auto const maxzoom = std::get<3>(filter);

                // If zoom level is relevant to filter
                // OR if the style layer minzoom is styling overzoomed tiles...
                // continue filtering. Else, no need to keep the layer.
                if ((baton->zoom >= minzoom && baton->zoom <= maxzoom) ||
                    (baton->maxzoom && *(baton->maxzoom) < minzoom)) {

                    // Skip feature re-encoding when filter is null/empty AND we have no property k/v filter
                    if (std::get<0>(filter) == mbgl::style::Filter() && property_filter.first == Filters::filter_properties_types::all) {
                        finalvt.add_existing_layer(layer); // Add to new tile
                    } else {
                        auto const minimal_zoom = (baton->maxzoom && (*(baton->maxzoom) < baton->zoom || *(baton->maxzoom) < minzoom)) ? *(baton->maxzoom) : baton->zoom;
                        auto maximum_zoom = minimal_zoom;
                        if (baton->maxzoom && (*(baton->maxzoom) < minzoom || *(baton->maxzoom) <= minimal_zoom)) {
                            // This is a tile of max-zoom (e.g. tiles till 16 and tile 16 contains features which should then tbe displayed at zoom level 19).
                            // Every higher zoom will use this tile for overzooming -> check zoom levels till max zoom
                            maximum_zoom = maxzoom;
                        }
                        // Ampersand in front of var: "Pass as pointers"
                        filterFeatures(&finalvt, minimal_zoom, maximum_zoom, layer, mbgl_filter_obj, property_filter);
                    }
                }
            }
        } // finished iterating through layers

        if (baton->compress) {
            // Compress final tile before sending back
            std::string final_data;
            finalvt.serialize(final_data);
            gzip::Compressor compressor;
            compressor.compress(*baton->shaved_tile, final_data.data(), final_data.size());
        } else {
            finalvt.serialize(*baton->shaved_tile);
        }
    } catch (std::exception const& ex) {
        // TODO(carol): Since the majority of code in this method is wrapped in a try/catch,
        // we could chain caught exceptions here to individually identify and return specific
        // error messages based on exception type. For example: "protozero::exception" per
        // https://github.com/mapbox/protozero/blob/master/include/protozero/exception.hpp#L30
        baton->error_name = ex.what();
    }
} // end AsyncShave()

// handle results from AsyncShave - if there are errors return those
// otherwise return the type & info to our callback
void AfterShave(uv_work_t* req) {
    Nan::HandleScope scope;
    auto* baton = static_cast<AsyncBaton*>(req->data); // NOLINT since we're in the process of refactoring to remove AsyncBaton and use Nan::AysncWorker

    if (!baton->error_name.empty()) {
        v8::Local<v8::Value> argv[1] = {Nan::Error(baton->error_name.c_str())};
        Nan::MakeCallback(Nan::GetCurrentContext()->Global(), Nan::New(baton->cb), 1, static_cast<v8::Local<v8::Value>*>(argv));
    } else // no errors, lets return data
    {
        // create buffer from std string
        std::string& shaved_tile_buffer = *baton->shaved_tile;
        v8::Local<v8::Value> argv[2] = {Nan::Null(),
                                        Nan::NewBuffer(&shaved_tile_buffer[0],
                                                       shaved_tile_buffer.size(),
                                                       [](char*, void* hint) {
                                                           delete reinterpret_cast<std::string*>(hint);
                                                       },
                                                       baton->shaved_tile.release())
                                            .ToLocalChecked()};
        Nan::MakeCallback(Nan::GetCurrentContext()->Global(), Nan::New(baton->cb), 2, static_cast<v8::Local<v8::Value>*>(argv));
    }

    // Release, mark as garbage collectible
    baton->cb.Reset();
    baton->buffer.Reset();
    baton->filters_obj->_unref();
    delete baton; // NOLINT since we're in the process of refactoring to remove AsyncBaton and use Nan::AysncWorker
}
