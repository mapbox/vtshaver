#include "shave.hpp"
#include "filters.hpp"

#include <cmath>
#include <exception>
#include <gzip/compress.hpp>
#include <gzip/decompress.hpp>
#include <gzip/utils.hpp>
#include <map>
#include <mbgl/style/conversion.hpp>
#include <mbgl/style/conversion/filter.hpp>
#include <mbgl/style/filter.hpp>
#include <mbgl/tile/geometry_tile_data.hpp>

#include <tuple>
#include <utility>

#include <vtzero/builder.hpp>
#include <vtzero/index.hpp>
#include <vtzero/property_mapper.hpp>
#include <vtzero/vector_tile.hpp>

inline Napi::Value CallbackError(std::string const& message, Napi::CallbackInfo const& info) {
    Napi::Object obj = Napi::Object::New(info.Env());
    obj.Set("message", message);
    auto func = info[info.Length() - 1].As<Napi::Function>();
    // ^^^ here we assume that info has a valid callback function
    // TODO: consider changing either method signature or adding internal checks
    return func.Call({obj});
}

struct QueryData {
    QueryData(Napi::Buffer<char> const& buffer, float zoom, mbgl::optional<float> maxzoom, bool compress, Filters* filters)
        : buffer_ref{Napi::Persistent(buffer)},
          data_{buffer.Data()},
          dataLength_{buffer.Length()},
          zoom_{zoom},
          maxzoom_{std::move(maxzoom)},
          compress_{compress},
          filters_{filters} {}

    const char* data() const {
        return data_;
    }
    std::size_t dataLength() const {
        return dataLength_;
    }
    float zoom() const {
        return zoom_;
    }
    mbgl::optional<float> maxzoom() const {
        return maxzoom_;
    }
    bool compress() const {
        return compress_;
    }
    Filters* filters() {
        return filters_;
    }

  private:
    Napi::Reference<Napi::Buffer<char>> buffer_ref;
    char const* data_;
    std::size_t dataLength_;
    float zoom_;
    mbgl::optional<float> maxzoom_;
    bool compress_;
    Filters* filters_;
};

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
    mbgl::PropertyMap map_ = {};
    mbgl::GeometryCollection geom_ = {};

  public:
    VTZeroGeometryTileFeature(vtzero::feature const& feature, mbgl::FeatureType ftype)
        : feature_(feature),
          ftype_(ftype) {
        feature_.for_each_property([&](const vtzero::property& prop) {
            map_.emplace(std::string(prop.key()), vtzero::convert_property_value<mbgl::Value, mapping>(prop.value()));
            return true;
        });
    }

    auto getType() const -> mbgl::FeatureType override {
        return ftype_;
    }

    auto getID() const -> mbgl::FeatureIdentifier override {
        if (feature_.has_id()) {
            return {feature_.id()}; // Brackets create empty optional type
        }
        return mbgl::FeatureIdentifier{};
    }

    auto getProperties() const -> const mbgl::PropertyMap& override {
        return map_;
    }

    auto getValue(const std::string& key) const -> mbgl::optional<mbgl::Value> override {
        mbgl::optional<mbgl::Value> obj;
        auto itr = map_.find(key);
        if (itr != map_.end()) {
            obj = itr->second;
        }
        return obj;
    }

    auto getGeometries() const -> const mbgl::GeometryCollection& override {
        // LCOV_EXCL_START
        return geom_;
        // LCOV_EXCL_STOP
    }
};

static auto evaluate(mbgl::style::Filter const& filter,
                     float zoom,
                     mbgl::FeatureType ftype,
                     vtzero::feature const& feature) -> bool {
    VTZeroGeometryTileFeature geomfeature(feature, ftype);
    mbgl::style::expression::EvaluationContext context(zoom, &geomfeature);
    return filter(context);
}

static auto convertGeom(vtzero::GeomType geometry_type) -> mbgl::FeatureType {
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
                    float zoom,
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
        if (evaluate(mbgl_filter_obj, zoom, geometry_type, feature)) {
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

struct Shaver : Napi::AsyncWorker {
    using Base = Napi::AsyncWorker;

    Shaver(std::unique_ptr<QueryData>&& query_data, Napi::Function const& callback)
        : Base(callback),
          query_data_(std::move(query_data)),
          shaved_tile_(std::make_unique<std::string>()) {}

    void Execute() override {
        vtzero::data_view dv{query_data_->data(), query_data_->dataLength()}; // Read input data
        std::string uncompressed;
        try {

            if (gzip::is_compressed(query_data_->data(), query_data_->dataLength())) {
                // Decompress tile before reading data
                gzip::Decompressor decompressor;
                decompressor.decompress(uncompressed, query_data_->data(), query_data_->dataLength());
                dv = vtzero::data_view(uncompressed);
            }

            vtzero::vector_tile vt{dv}; // Needed for reading the tile
            vtzero::tile_builder finalvt;

            auto const& active_filters = query_data_->filters()->get_filters();
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
                    if ((query_data_->zoom() >= minzoom && query_data_->zoom() <= maxzoom) ||
                        (query_data_->maxzoom() && *query_data_->maxzoom() < minzoom)) {

                        // Skip feature re-encoding when filter is null/empty AND we have no property k/v filter
                        if (std::get<0>(filter) == mbgl::style::Filter() && property_filter.first == Filters::filter_properties_types::all) {
                            finalvt.add_existing_layer(layer); // Add to new tile
                        } else {
                            // Ampersand in front of var: "Pass as pointers"
                            filterFeatures(&finalvt, query_data_->zoom(), layer, mbgl_filter_obj, property_filter);
                        }
                    }
                }
            } // finished iterating through layers

            if (query_data_->compress()) {
                // Compress final tile before sending back
                std::string final_data;
                finalvt.serialize(final_data);
                gzip::Compressor compressor;
                compressor.compress(*shaved_tile_, final_data.data(), final_data.size());
            } else {
                finalvt.serialize(*shaved_tile_);
            }
        } catch (std::exception const& ex) {
            SetError(ex.what());
        }
    }

    std::vector<napi_value> GetResult(Napi::Env env) override {
        if (shaved_tile_) {
            std::string& shaved_tile_buffer = *shaved_tile_;
            auto buffer = Napi::Buffer<char>::New(
                Env(),
                &shaved_tile_buffer[0],
                shaved_tile_buffer.size(),
                [](Napi::Env env_, char* /*unused*/, std::string* str_ptr) {
                    if (str_ptr != nullptr) {
                        Napi::MemoryManagement::AdjustExternalMemory(env_, -static_cast<std::int64_t>(str_ptr->size()));
                    }
                    delete str_ptr;
                },
                shaved_tile_.release());
            Napi::MemoryManagement::AdjustExternalMemory(env, static_cast<std::int64_t>(shaved_tile_buffer.size()));
            return {Env().Null(), buffer};
        }
        return Base::GetResult(env); // returns an empty vector (default)
    }

  private:
    std::unique_ptr<QueryData> query_data_;
    std::unique_ptr<std::string> shaved_tile_;
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
Napi::Value shave(Napi::CallbackInfo const& info) {
    // CALLBACK: ensure callback is a function
    std::size_t length = info.Length();
    if (length == 0) {
        Napi::Error::New(info.Env(), "last argument must be a callback function").ThrowAsJavaScriptException();
        return info.Env().Null();
    }
    Napi::Value callback_val = info[info.Length() - 1];
    if (!callback_val.IsFunction()) {
        Napi::Error::New(info.Env(), "last argument must be a callback function").ThrowAsJavaScriptException();
        return info.Env().Null();
    }

    Napi::Function callback = callback_val.As<Napi::Function>();

    // BUFFER: check first argument, should be a pbf object

    if (!info[0].IsBuffer()) {
        return CallbackError("first arg 'buffer' must be a Protobuf buffer object", info);
    }
    auto buffer = info[0].As<Napi::Buffer<char>>();

    // OPTIONS: check second argument, should be an 'options' object
    Napi::Value options_val = info[1];
    if (!options_val.IsObject()) {
        return CallbackError("second arg 'options' must be an object", info);
    }
    auto options = options_val.As<Napi::Object>();

    // check zoom, should be a number
    std::uint32_t zoom = 0;
    if (!options.Has("zoom")) {
        return CallbackError("option 'zoom' not provided. Please provide a zoom level for this tile.", info);
    }
    Napi::Value zoom_val = options.Get("zoom");
    if (!zoom_val.IsNumber() || zoom_val.As<Napi::Number>().DoubleValue() < 0) {
        return CallbackError("option 'zoom' must be a positive integer.", info);
    }
    zoom = zoom_val.As<Napi::Number>();

    // check maxzoom, should be a number
    mbgl::optional<float> maxzoom;
    if (options.Has("maxzoom")) {
        // Validate optional "maxzoom" value
        Napi::Value maxzoom_val = options.Get("maxzoom");
        if (!maxzoom_val.IsNumber() || maxzoom_val.As<Napi::Number>().FloatValue() < 0) {
            return CallbackError("option 'maxzoom' must be a positive integer.", info);
        }
        maxzoom = maxzoom_val.As<Napi::Number>().FloatValue();
    }

    // validate compress (OPTIONAL)
    bool compress = false;
    if (options.Has("compress")) {
        Napi::Value compress_options_val = options.Get("compress");
        Napi::Object compress_options = compress_options_val.As<Napi::Object>();

        // compress.type is REQUIRED
        if (!compress_options.Has("type")) {
            return CallbackError("compress option 'type' not provided. Please provide "
                                 "a compression type if using the compress option",
                                 info);
        }

        Napi::Value compress_type = compress_options.Get("type");
        if (!compress_type.IsString()) {
            return CallbackError("compress option 'type' must be a string", info);
        }

        std::string str = compress_type.As<Napi::String>();
        // compress.type can only be 'none' and 'gzip' for now
        if (str != "none" && str != "gzip") {
            return CallbackError("compress type must equal 'none' or 'gzip'", info);
        }
        if (str == "gzip") {
            compress = true;
        }

        // compress.level is OPTIONAL ------ FIXME FAIL!
        if (compress_options.Has("level")) {
            Napi::Value compress_level = compress_options.Get("level");
            if (!compress_level.IsNumber() || compress_level.As<Napi::Number>().Int32Value() < 0) {
                return CallbackError("compress option 'level' must be an unsigned integer", info);
            }
        }
    }

    // `filters` comes in as a shaver.Filters object
    if (options.Has("filters")) {
        Napi::Value filters_val = options.Get("filters");
        // options.filters will now be an Object
        if (filters_val.IsNull() ||
            filters_val.IsUndefined() ||
            !filters_val.IsObject()) {
            return CallbackError(
                "option 'filters' must be a shaver.Filters object",
                info);
        }

        Napi::Object filters_object = filters_val.As<Napi::Object>();

        // This is the same as calling InstanceOf() in JS-world
        // [ /Nan::New\((\w+)\)->HasInstance\((\w+)\)/g, '$2.InstanceOf($1.Value())' ]
        if (!filters_object.InstanceOf(Filters::constructor.Value())) {
            return CallbackError(
                "option 'filters' must be a shaver.Filters object",
                info);
        }

        // set up the query_data to pass into our threadpool
        auto query_data = std::make_unique<QueryData>(buffer, zoom, maxzoom, compress, Napi::ObjectWrap<Filters>::Unwrap(filters_object));
        auto* worker = new Shaver{std::move(query_data), callback};
        worker->Queue();
        return info.Env().Undefined();
    }
    return CallbackError("must create a filters object using Shaver.Filters() and pass filters in to Shaver.shave", info);
}
