#pragma once

#include <napi.h>

// shave, custom async method
Napi::Value shave(Napi::CallbackInfo const& info);
