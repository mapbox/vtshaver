#include "filters.hpp"
#include <exception>
#include <map>
#include <mbgl/style/conversion.hpp>
#include <mbgl/style/conversion/filter.hpp>
#include <mbgl/style/conversion/json.hpp>
#include <mbgl/style/filter.hpp>
#include <string>
#include <utility>

Napi::FunctionReference Filters::constructor; // NOLINT

Napi::Object Filters::Initialize(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "Filters",
                                      {InstanceMethod("layers", &Filters::layers)});
    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();
    exports.Set("Filters", func);
    return exports;
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

Filters::Filters(Napi::CallbackInfo const& info)
    : Napi::ObjectWrap<Filters>(info) {
    if (!info.IsConstructCall()) {
        Napi::TypeError::New(Env(), "Cannot call constructor as function, you need to use 'new' keyword");
        return;
    }

    if (info.IsConstructCall()) {
        try {
            if (info.Length() >= 1) {
                Napi::Value filters_val = info[0];
                if (!filters_val.IsObject()) {
                    Napi::Error::New(Env(), "filters must be an object and cannot be null or undefined").ThrowAsJavaScriptException();
                    return;
                }
                Napi::Object filters_ = filters_val.As<Napi::Object>();
                Napi::Array layers = filters_.GetPropertyNames();
                // Loop through each layer in the object and convert its filter to a mbgl::style::Filter
                std::uint32_t length = layers.Length();
                for (std::uint32_t i = 0; i < length; ++i) {
                    Napi::Value layer_key = layers.Get(i);
                    if (layer_key.IsNull() || layer_key.IsUndefined()) {
                        Napi::Error::New(Env(), "layer name must be a string and cannot be null or undefined").ThrowAsJavaScriptException();
                        return;
                    }

                    // get v8::Object containing layer
                    Napi::Value layer_val = filters_.Get(layer_key);

                    if (!layer_val.IsObject() || layer_val.IsNull() || layer_val.IsUndefined()) {
                        Napi::Error::New(Env(), "layer must be an object and cannot be null or undefined").ThrowAsJavaScriptException();
                        return;
                    }
                    auto layer = layer_val.As<Napi::Object>();

                    // set default 0/22 for min/max zooms
                    // if they exist in the filter object, update the values here
                    zoom_type minzoom = 0;
                    zoom_type maxzoom = 22;
                    if (layer.Has("minzoom")) {
                        Napi::Value minzoom_val = layer.Get("minzoom");
                        if (!minzoom_val.IsNumber() || minzoom_val.As<Napi::Number>().DoubleValue() < 0) {
                            Napi::Error::New(Env(), "Value for 'minzoom' must be a positive number.").ThrowAsJavaScriptException();
                            return;
                        }
                        minzoom = minzoom_val.As<Napi::Number>().DoubleValue();
                    } else {
                        Napi::Error::New(Env(), "Filter must include a minzoom property.").ThrowAsJavaScriptException();
                        return;
                    }
                    if (layer.Has("maxzoom")) {
                        Napi::Value maxzoom_val = layer.Get("maxzoom");
                        if (!maxzoom_val.IsNumber() || maxzoom_val.As<Napi::Number>().DoubleValue() < 0) {
                            Napi::Error::New(Env(), "Value for 'maxzoom' must be a positive number.").ThrowAsJavaScriptException();
                            return;
                        }
                        maxzoom = maxzoom_val.As<Napi::Number>().DoubleValue();
                    } else {
                        Napi::Error::New(Env(), "Filter must include a maxzoom property.").ThrowAsJavaScriptException();
                        return;
                    }
                    // handle filters array
                    const Napi::Value layer_filter = layer.Get("filters");
                    // error handling in case filter value passed in from JS-world is somehow invalid
                    if (layer_filter.IsNull() || layer_filter.IsUndefined()) {
                        Napi::Error::New(Env(), "Filters is not properly constructed.").ThrowAsJavaScriptException();
                        return;
                    }

                    // Convert each filter array to an mbgl::style::Filter object
                    mbgl::style::Filter filter;

                    // NOTICE: If a layer is styled, but does not have a filter, the filter value will equal
                    // true (see logic within lib/styleToFilters.js)
                    // Ex: { water: true }
                    // Because of this, we check for if the filter is an array or a boolean before converting to a mbgl Filter
                    // If a boolean and is true, create a null/empty Filter object.
                    Napi::Object json = Env().Global().Get("JSON").As<Napi::Object>();
                    Napi::Function stringify = json.Get("stringify").As<Napi::Function>();

                    if (layer_filter.IsArray()) {
                        mbgl::style::conversion::Error filterError;
                        std::string filter_str = stringify.Call(json, {layer_filter}).As<Napi::String>();
                        auto optional_filter = mbgl::style::conversion::convertJSON<mbgl::style::Filter>(filter_str, filterError);
                        if (!optional_filter) {
                            if (filterError.message == "filter property must be a string") {
                                Napi::TypeError::New(Env(), "Unable to create Filter object, ensure all filters are expression-based").ThrowAsJavaScriptException();

                            } else {
                                Napi::TypeError::New(Env(), filterError.message.c_str()).ThrowAsJavaScriptException();
                            }
                            return;
                        }
                        filter = *optional_filter;
                    } else if (layer_filter.IsBoolean() && layer_filter.As<Napi::Boolean>()) {
                        filter = mbgl::style::Filter{};
                    } else {
                        Napi::TypeError::New(Env(), "invalid filter value, must be an array or a boolean").ThrowAsJavaScriptException();
                        return;
                    }

                    // insert the key/value into filters map
                    // TODO(dane): what if we have duplicate source-layer filters?

                    // handle property array
                    Napi::Value const layer_properties = layer.Get("properties");
                    if (layer_properties.IsNull() || layer_properties.IsUndefined()) {
                        Napi::Error::New(Env(), "Property-Filters is not properly constructed.").ThrowAsJavaScriptException();
                        return;
                    }

                    // NOTICE: If a layer is styled, but does not have a property, the property value will equal []
                    // NOTICE: If a property is true, that means we need to keep all the properties
                    filter_properties_type property;
                    if (layer_properties.IsArray()) {
                        auto propertyArray = layer_properties.As<Napi::Array>();
                        std::uint32_t propertiesLength = propertyArray.Length();
                        std::vector<std::string> values;
                        values.reserve(propertiesLength);
                        for (std::uint32_t index = 0; index < propertiesLength; ++index) {
                            Napi::Value property_value = propertyArray.Get(index);
                            std::string value = property_value.As<Napi::String>();
                            if (!value.empty()) {
                                values.emplace_back(value);
                            }
                        }
                        property.first = list;
                        property.second = values;
                    } else if (layer_properties.IsBoolean() && layer_properties.As<Napi::Boolean>()) {
                        property.first = all;
                        property.second = {};
                    } else {
                        Napi::TypeError::New(Env(), "invalid filter value, must be an array or a boolean").ThrowAsJavaScriptException();
                        return;
                    }
                    std::string source_layer = layer_key.ToString();
                    add_filter(std::move(source_layer), std::move(filter), std::move(property), minzoom, maxzoom);
                }
            }
        } catch (std::exception const& ex) {
            Napi::TypeError::New(Env(), ex.what()).ThrowAsJavaScriptException();
        }
    }
}

Napi::Value Filters::layers(Napi::CallbackInfo const& info) {
    Napi::HandleScope scope(info.Env());
    auto layers = Napi::Array::New(Env());
    std::uint32_t idx = 0;
    for (auto const& lay : filters) {
        layers.Set(idx++, lay.first);
    }
    return layers;
}
