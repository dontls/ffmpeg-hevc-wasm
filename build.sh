#!/bin/bash

set -e

LIB_TARGET="$PWD/asm-lib"

export EXPORTED_FUNCTIONS="[ \
  '_jsNewDecoder', \
  '_jsInitDecoder', \
  '_jsDecodec', \
  '_jsReleaseDecoder', \
  '_malloc'
]"

FFMPEG_FLAGS=(
  --cc=emcc
  --cxx=em++
  --ar=emar
  --nm=emnm
  --ranlib=emranlib
  --prefix=$LIB_TARGET
  --enable-cross-compile
  --target-os=none 
  --arch=x86_32 
  --cpu=generic 
  --enable-gpl 
  --enable-version3 
  --disable-avdevice 
  --disable-swresample 
  --disable-avfilter
  --disable-programs 
  --disable-logging 
  --disable-everything 
  --disable-avformat 
  --disable-ffplay 
  --disable-ffprobe 
  --disable-asm 
  --disable-doc 
  --disable-devices 
  --disable-network 
  --disable-hwaccels
  --disable-parsers 
  --disable-bsfs 
  --disable-debug 
  # --enable-protocol=file 
  # --enable-demuxer=mov 
  # --enable-demuxer=flv 
  --disable-indevs 
  --disable-outdevs
  --enable-decoder=hevc
  --enable-decoder=h264
  --extra-cflags="-msimd128"
  --extra-cxxflags="-msimd128"
)

case $1 in
  ffmpeg)
    mkdir "$LIB_TARGET"
    cd ffmpeg
    emconfigure ./configure ${FFMPEG_FLAGS[@]}
    emmake make
    emmake make install
    cd ..
    ;;
  go)
    emcc src/asm_decoder.cpp \
      asm-lib/lib/libavcodec.a \
      asm-lib/lib/libavutil.a \
      -O3 \
      -I"asm-lib/include" \
      -fno-threadsafe-statics \
      -s WASM=1 \
      -s STANDALONE_WASM=1 \
      --no-entry \
      -s EXPORTED_FUNCTIONS='["_jsNewDecoder","_jsInitDecoder","_jsDecodec","_jsReleaseDecoder", "_malloc"]' \
      -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
      -msimd128 \
      -o gowasm/asm_decode.wasm
    ;;
  *)
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
      -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
      -msimd128 \
      -o build/video_decode.js
    ;;  
esac


# wasm-opt -O2 --enable-bulk-memory --enable-threads --enable-simd -o build/decode_video_o2.wasm build/decode_video.wasm
# mv build/decode_video_o2.wasm build/decode_video.wasm

# sed -i 's/= import.meta.url/= undefined/g' build/decode_video.js
