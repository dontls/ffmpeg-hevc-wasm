package main

import (
	"context"
	_ "embed"
	"encoding/binary"
	"log"
	"os"
	"time"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/experimental"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

//go:embed asm_decode.wasm
var asmDecodeWasm []byte

func onVideoCallback(ctx context.Context, mod api.Module, buffPtr, width, height uint32, ts float64) {
	mem := mod.Memory()
	if data, ok := mem.Read(buffPtr, width*height*3/2); ok {
		log.Printf("[onVideo] 视频帧: %dx%d, %d bytes, ts=%f", width, height, len(data), ts)
	}
}

func onAudioCallback(ctx context.Context, mod api.Module, buffPtr, size uint32) {
	mem := mod.Memory()
	if data, ok := mem.Read(buffPtr, size); ok {
		log.Printf("[onAudio] 音频帧: %d bytes", len(data))
	}
}
func main() {
	ctx := context.Background()

	cfg := wazero.NewRuntimeConfig().WithCoreFeatures(
		api.CoreFeaturesV2 | experimental.CoreFeaturesThreads,
	)
	r := wazero.NewRuntimeWithConfig(ctx, cfg)
	defer r.Close(ctx)
	// 先实例化 WASI
	if _, err := wasi_snapshot_preview1.Instantiate(ctx, r); err != nil {
		panic(err)
	}
	// 注册 host callbacks
	_, err := r.NewHostModuleBuilder("env").
		NewFunctionBuilder().WithFunc(onVideoCallback).Export("__wasm_call_onVideo").
		NewFunctionBuilder().WithFunc(onAudioCallback).Export("__wasm_call_onAudio").
		Instantiate(ctx)
	if err != nil {
		log.Panicf("failed to instantiate host module: %v", err)
	}

	// 实例化 wasm
	mod, err := r.Instantiate(ctx, asmDecodeWasm)
	if err != nil {
		log.Panicf("failed to instantiate wasm module: %v", err)
	}

	// 导出函数
	initDecoder := mod.ExportedFunction("jsInitDecoder")
	decodec := mod.ExportedFunction("jsDecodec")
	releaseDecoder := mod.ExportedFunction("jsReleaseDecoder")
	malloc := mod.ExportedFunction("malloc")

	if initDecoder == nil || decodec == nil || releaseDecoder == nil || malloc == nil {
		log.Panicf("one or more required exports not found")
	}

	// 1. 创建解码器
	ret, err := initDecoder.Call(ctx)
	if err != nil {
		log.Panicf("jsInitDecoder failed: %v", err)
	}
	handle := ret[0]
	log.Printf("[OK] 解码器句柄: %d", handle)
	// 2. 分配内存写入测试数据
	ret, err = malloc.Call(ctx, 1048576*4) // 1MB
	if err != nil {
		log.Panicf("malloc failed: %v", err)
	}
	framePtr := uint32(ret[0])
	file, err := os.Open("test.cache")
	if err != nil {
		log.Fatalln(err)
	}
	defer file.Close()
	for {
		var h [11]byte
		n, err := file.Read(h[:])
		if n != 11 || err != nil {
			break
		}
		l := int(binary.LittleEndian.Uint32(h[7:]))
		data := make([]byte, l)
		n, err = file.Read(data)
		if n != l || err != nil {
			break
		}
		ftype := binary.LittleEndian.Uint16(data)
		channel := binary.LittleEndian.Uint16(data[2:])
		ts := binary.LittleEndian.Uint64(data[4:])
		log.Printf("channel %d type %d ts %v\n", channel, ftype, ts)
		t0 := time.Now()
		if !mod.Memory().Write(framePtr, data) {
			log.Panicf("failed to write frame data into wasm memory")
		}
		// 3. 调用解码
		ret, err = decodec.Call(ctx, uint64(framePtr), uint64(len(data)))
		if err != nil {
			log.Panicf("jsDecodec failed: %v %d", err, ret[0])
		}
		log.Printf("[OK] jsDecodec 执行成功 %v", time.Since(t0))
	}

	// 4. 释放解码器
	_, err = releaseDecoder.Call(ctx)
	if err != nil {
		log.Panicf("jsReleaseDecoder failed: %v", err)
	}
	log.Println("[OK] 解码器已释放")
}
