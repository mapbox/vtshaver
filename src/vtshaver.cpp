#include "filters.hpp"
#include "shave.hpp"

Napi::Object init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "shave"), Napi::Function::New(env, shave));
    Filters::Initialize(env, exports);
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, init) // NOLINT
