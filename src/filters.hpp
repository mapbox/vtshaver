#pragma once

#include <map>
#include <mbgl/style/filter.hpp>
#include <nan.h>
#include <tuple>

// This class adheres to the rule of Zero
// because we define no custom destructor or copy constructor
class Filters : public Nan::ObjectWrap {
  public:
    using filter_value_type = mbgl::style::Filter;
    using filter_key_type = std::string; // TODO: convert to data_view
    using zoom_type = double;
    using filter_values_type = std::tuple<filter_value_type, zoom_type, zoom_type>;
    using filters_type = std::map<filter_key_type, filter_values_type>;

    // initializer
    static void Initialize(v8::Local<v8::Object> target);

    // method required for the constructor
    static NAN_METHOD(New); // Filters instance is stored here

    static Nan::Persistent<v8::FunctionTemplate>& constructor();

    void add_filter(filter_key_type&& key, filter_value_type&& filter, zoom_type minzoom, zoom_type maxzoom) {
        // add a new key/value pair, with the value equaling a tuple 'filter_values_type' defined above
        filters.emplace(key, std::make_tuple(std::move(filter), minzoom, maxzoom));
    }

    filters_type const& get_filters() const {
        return filters;
    }

    // Grabs the persisted Filters ref
    // Calling this within vt_shaver when creating the baton
    void _ref() { Ref(); }
    // To setup for garbage collection
    void _unref() { Unref(); }

  private:
    filters_type filters{};
};