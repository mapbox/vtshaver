#include "filters.hpp"

#include <exception>
#include <map>
// This header must come before `mgbl` headers
// So we ask clang-format not to re-order
// clang-format off
#include <node/src/node_conversion.hpp>
// clang-format on
#include <mbgl/style/conversion.hpp>
#include <mbgl/style/conversion/filter.hpp>
#include <mbgl/style/filter.hpp>
#include <string>
#include <utility>

// Single constructor used for any new instance of it.
auto Filters::constructor() -> Nan::Persistent<v8::FunctionTemplate>& {
    static Nan::Persistent<v8::FunctionTemplate> init;
    return init;
} // LCOV_EXCL_LINE

void Filters::Initialize(v8::Local<v8::Object> target) {
    Nan::HandleScope scope;
    v8::Local<v8::FunctionTemplate> lcons = Nan::New<v8::FunctionTemplate>(Filters::New);
    lcons->InstanceTemplate()->SetInternalFieldCount(1);
    lcons->SetClassName(Nan::New("Filters").ToLocalChecked());
    Nan::SetPrototypeMethod(lcons, "layers", layers);
    target->Set(Nan::New("Filters").ToLocalChecked(), lcons->GetFunction());
    constructor().Reset(lcons);
}

/**
 * Takes optimized filter object from shaver.styleToFilters and returns c++ filters for shave.
 * @class Filters
 * @param {Object} filters - the filter object from the `shaver.styleToFilters`
 * @example
 * var shaver = require('@mapbox/vtshaver');
 * var style = require('/path/to/style.json');
 * // get the filters object from `styleToFilters`
 * var styleFilters = shaver.styleToFilters(style);
 * // call the function to create filters
 * var filters = new shaver.Filters(styleFilters);
 */
NAN_METHOD(Filters::New) {
    if (!info.IsConstructCall()) {
        return Nan::ThrowTypeError(
            "Cannot call constructor as function, you need to use 'new' keyword");
    }
    if (info.IsConstructCall()) {
        try {
            auto* const self = new Filters(); // NOLINT since we're in the process of refactoring
            self->Wrap(info.This());

            // Take the v8 filters array as a param,
            // filters come in as an object of filters per layer, from JS
            // convert the JS filters arg to a C++ object,
            // and create a `Filters` class instance
            if (info.Length() >= 1) {
                // get v8::Object containing filters
                v8::Local<v8::Value> filters_val = info[0];
                if (!filters_val->IsObject() || filters_val->IsNull() || filters_val->IsUndefined()) {
                    Nan::ThrowError("filters must be an object and cannot be null or undefined");
                    return;
                }
                auto filters = filters_val.As<v8::Object>();

                // get v8::Array of layers
                v8::Local<v8::Value> layers_val = filters->GetPropertyNames();
                // LCOV_EXCL_START
                // the GetPropertyNames returns an Array, so we don't need to test the v8
                if (!layers_val->IsArray() || layers_val->IsNull() || layers_val->IsUndefined()) {
                    Nan::ThrowError("layers must be an array and cannot be null or undefined");
                    return;
                }
                // LCOV_EXCL_STOP
                auto layers = layers_val.As<v8::Array>(); // Even if there layers_val is a string instead of an array, convert it to an array

                // Loop through each layer in the object and convert its filter to a mbgl::style::Filter
                std::uint32_t length = layers->Length();
                for (std::uint32_t i = 0; i < length; ++i) {
                    // get v8::String containing layer name
                    v8::Local<v8::Value> layer_key = layers->Get(i);
                    // the layer_key is the name of the object, since we have checked the layers->Length(), which means layers->Get(i) can not be null undefined or others
                    if (layer_key->IsNull() || layer_key->IsUndefined()) {
                        Nan::ThrowError("layer name must be a string and cannot be null or undefined");
                        return;
                    }

                    // get v8::Object containing layer
                    v8::Local<v8::Value> layer_val = filters->Get(layer_key);

                    if (!layer_val->IsObject() || layer_val->IsNull() || layer_val->IsUndefined()) {
                        Nan::ThrowError("layer must be an object and cannot be null or undefined");
                        return;
                    }
                    auto layer = layer_val.As<v8::Object>();

                    // set default 0/22 for min/max zooms
                    // if they exist in the filter object, update the values here
                    zoom_type minzoom = 0;
                    zoom_type maxzoom = 22;
                    if (layer->Has(Nan::New("minzoom").ToLocalChecked())) {
                        v8::Local<v8::Value> minzoom_val = layer->Get(Nan::New("minzoom").ToLocalChecked());
                        if (!minzoom_val->IsNumber() || minzoom_val->NumberValue() < 0) {
                            Nan::ThrowError("Value for 'minzoom' must be a positive number.");
                            return;
                        }
                        minzoom = minzoom_val->NumberValue();
                    } else {
                        Nan::ThrowError("Filter must include a minzoom property.");
                        return;
                    }
                    if (layer->Has(Nan::New("maxzoom").ToLocalChecked())) {
                        v8::Local<v8::Value> maxzoom_val = layer->Get(Nan::New("maxzoom").ToLocalChecked());
                        if (!maxzoom_val->IsNumber() || maxzoom_val->NumberValue() < 0) {
                            Nan::ThrowError("Value for 'maxzoom' must be a positive number.");
                            return;
                        }
                        maxzoom = maxzoom_val->NumberValue();
                    } else {
                        Nan::ThrowError("Filter must include a maxzoom property.");
                        return;
                    }
                    // handle filters array
                    const v8::Local<v8::Value> layer_filter = layer->Get(Nan::New("filters").ToLocalChecked());
                    // error handling in case filter value passed in from JS-world is somehow invalid
                    if (layer_filter->IsNull() || layer_filter->IsUndefined()) {
                        Nan::ThrowError("Filters is not properly constructed.");
                        return;
                    }

                    // Convert each filter array to an mbgl::style::Filter object
                    mbgl::style::Filter filter;

                    // NOTICE: If a layer is styled, but does not have a filter, the filter value will equal
                    // true (see logic within lib/styleToFilters.js)
                    // Ex: { water: true }
                    // Because of this, we check for if the filter is an array or a boolean before converting to a mbgl Filter
                    // If a boolean and is true, create a null/empty Filter object.
                    if (layer_filter->IsArray()) {
                        mbgl::style::conversion::Error filterError;
                        const auto converted_mbgl_optional_style_filter = mbgl::style::conversion::convert<mbgl::style::Filter>(layer_filter, filterError);

                        if (!converted_mbgl_optional_style_filter) {
                            if (filterError.message == "filter property must be a string") {
                                Nan::ThrowTypeError("Unable to create Filter object, ensure all filters are expression-based");
                            } else {
                                Nan::ThrowTypeError(filterError.message.c_str());
                            }
                            return;
                        }
                        filter = *converted_mbgl_optional_style_filter;
                    } else if (layer_filter->IsBoolean() && layer_filter->IsTrue()) {
                        filter = mbgl::style::Filter{};
                    } else {
                        Nan::ThrowTypeError("invalid filter value, must be an array or a boolean");
                        return;
                    }

                    // insert the key/value into filters map
                    // TODO(dane): what if we have duplicate source-layer filters?

                    // handle property array
                    const v8::Local<v8::Value> layer_properties = layer->Get(Nan::New("properties").ToLocalChecked());
                    if (layer_properties->IsNull() || layer_properties->IsUndefined()) {
                        Nan::ThrowError("Property-Filters is not properly constructed.");
                        return;
                    }

                    // NOTICE: If a layer is styled, but does not have a property, the property value will equal []
                    // NOTICE: If a property is true, that means we need to keep all the properties
                    filter_properties_type property;
                    if (layer_properties->IsArray()) {
                        // const auto propertyArray = layer_properties.As<v8::Array>();
                        v8::Handle<v8::Array> propertyArray = v8::Handle<v8::Array>::Cast(layer_properties);
                        std::uint32_t propertiesLength = propertyArray->Length();
                        std::vector<std::string> values;
                        values.reserve(propertiesLength);
                        for (std::uint32_t index = 0; index < propertiesLength; ++index) {
                            v8::Local<v8::Value> property_value = propertyArray->Get(index);
                            Nan::Utf8String utf8_value(property_value);
                            int utf8_len = utf8_value.length();
                            if (utf8_len > 0) {
                                values.emplace_back(*utf8_value, static_cast<std::size_t>(utf8_len));
                            }
                        }
                        property.first = list;
                        property.second = values;
                    } else if (layer_properties->IsBoolean() && layer_properties->IsTrue()) {
                        property.first = all;
                        property.second = {};
                    } else {
                        Nan::ThrowTypeError("invalid filter value, must be an array or a boolean");
                        return;
                    }

                    std::string source_layer = *v8::String::Utf8Value(layer_key);

                    self->add_filter(std::move(source_layer), std::move(filter), std::move(property), minzoom, maxzoom);
                }
            }
        }
        // LCOV_EXCL_START
        catch (const std::exception& ex) {
            return Nan::ThrowTypeError(ex.what());
        }
        // LCOV_EXCL_STOP

        info.GetReturnValue().Set(info.This());
    }
}

NAN_METHOD(Filters::layers) {
    auto layers = Nan::New<v8::Array>();
    std::uint32_t idx = 0;
    auto* filters = Nan::ObjectWrap::Unwrap<Filters>(info.Holder());
    for (auto const& lay : filters->filters) {
        Nan::Set(layers, idx++, Nan::New<v8::String>(lay.first).ToLocalChecked());
    }
    info.GetReturnValue().Set(layers);
}