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
Nan::Persistent<v8::FunctionTemplate>& Filters::constructor() {
    static Nan::Persistent<v8::FunctionTemplate> init;
    return init;
} // LCOV_EXCL_LINE

void Filters::Initialize(v8::Local<v8::Object> target) {
    Nan::HandleScope scope;
    v8::Local<v8::FunctionTemplate> lcons = Nan::New<v8::FunctionTemplate>(Filters::New);
    lcons->InstanceTemplate()->SetInternalFieldCount(1);
    lcons->SetClassName(Nan::New("Filters").ToLocalChecked());
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
                if (!layers_val->IsArray() || layers_val->IsNull() || layers_val->IsUndefined()) {
                    Nan::ThrowError("layers must be an array and cannot be null or undefined");
                    return;
                }
                auto layers = layers_val.As<v8::Array>(); // Even if there layers_val is a string instead of an array, convert it to an array

                // Loop through each layer in the object and convert its filter to a mbgl::style::Filter
                uint32_t length = layers->Length();
                for (uint32_t i = 0; i < length; ++i) {
                    // get v8::String containing layer name
                    v8::Local<v8::Value> layer_name_val = layers->Get(i);
                    if (!layer_name_val->IsString() || layer_name_val->IsNull() || layer_name_val->IsUndefined()) {
                        Nan::ThrowError("layer name must be a string and cannot be null or undefined");
                        return;
                    }
                    auto layer_name = layer_name_val.As<v8::String>();

                    // get v8::Object containing layer
                    v8::Local<v8::Value> layer_val = filters->Get(layer_name);

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

                    std::string source_layer = *v8::String::Utf8Value(layer_name->ToString());

                    self->add_filter(std::move(source_layer), std::move(filter), minzoom, maxzoom);
                    // can find these via filters.find("x")->second
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