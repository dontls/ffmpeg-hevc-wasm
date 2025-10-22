#!/usr/bin/bash

set -e

LIB_TARGET="$PWD/asm-lib"

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

[ -d "$LIB_TARGET" ] && rm -rf "$LIB_TARGET"
mkdir "$LIB_TARGET"

cd ffmpeg

emconfigure ./configure ${FFMPEG_FLAGS[@]}

emmake make
emmake make install
