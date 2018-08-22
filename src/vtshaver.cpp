#include "filters.hpp"
#include "shave.hpp"

static void init(v8::Local<v8::Object> target) {
    Nan::SetMethod(target, "shave", shave);
    Filters::Initialize(target);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, init) // NOLINT