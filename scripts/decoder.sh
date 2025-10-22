#!/usr/bin/bash

set -e

export EXPORTED_FUNCTIONS="[ \
	'_jsNewDecoder', \
  '_jsDecodec', \
  '_jsReleaseDecoder', \
  '_malloc'
]"

# emcc src/asm_decoder.cpp \
#   asm-lib/lib/libavcodec.a \
#   asm-lib/lib/libavutil.a \
#   -O3 \
#   -I"ffmpeg-lib/include" \
#   -s WASM=1 \
#   -s ENVIRONMENT="worker" \
#   -s TOTAL_MEMORY=16777216 \
#   -s EXPORTED_FUNCTIONS="${EXPORTED_FUNCTIONS}" \
#   -s EXPORTED_RUNTIME_METHODS="['addFunction']" \
#   -s RESERVED_FUNCTION_POINTERS=14 \
#   -s FORCE_FILESYSTEM=1 \
#   -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
#   -msimd128 \
#   -o build/video_decode.js

# cd ../emsdk && source ./emsdk_env.sh

emcc src/asm_decoder.cpp \
  asm-lib/lib/libavcodec.a \
  asm-lib/lib/libavutil.a \
  -O3 \
  -I"asm-lib/include" \
  -s WASM=1 \
  -s MODULARIZE \
  -s ENVIRONMENT="worker" \
  -s MAXIMUM_MEMORY=16777216 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORT_ES6=1 \
  -s EXPORTED_RUNTIME_METHODS=ccall,cwrap \
  -s EXPORTED_FUNCTIONS="${EXPORTED_FUNCTIONS}" \
  -s EXPORTED_RUNTIME_METHODS="['addFunction', 'HEAPU8']" \
  -s RESERVED_FUNCTION_POINTERS=14 \
  -msimd128 \
  -o build/video_decode.js

# wasm-opt -O2 --enable-bulk-memory --enable-threads --enable-simd -o build/decode_video_o2.wasm build/decode_video.wasm
# mv build/decode_video_o2.wasm build/decode_video.wasm

# sed -i 's/= import.meta.url/= undefined/g' build/decode_video.js
