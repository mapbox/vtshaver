#pragma once

#include <napi.h>
#include <uv.h>

// shave, custom async method
Napi::Value shave(const Napi::CallbackInfo& info);
void AsyncShave(uv_work_t* req);
void AfterShave(uv_work_t* req);