#pragma once

#include <nan.h>

// shave, custom async method
NAN_METHOD(shave);
void AsyncShave(uv_work_t* req);
void AfterShave(uv_work_t* req);