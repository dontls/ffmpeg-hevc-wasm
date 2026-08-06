import decoder from "./out/asm_codec.js";

function logDebug(line) {
  console.log(line);
}

let _Module; // 存储解码模块实例
let _Buffer = null;
let _onVideo = null;
let _onAudio = null;
decoder().then((Module) => {
  _Module = Module;
  const postFrame = function (buff, w, h, ts) {
    const frame = Module.HEAPU8.subarray(buff);
    const videoFrame = new VideoFrame(frame, {
      codedWidth: w,
      codedHeight: h,
      timestamp: ts,
      format: "I420",
    });
    postMessage({ type: "frame", frame: videoFrame, w: w, h: h, ts: ts });
  };
  _onVideo = Module.addFunction(postFrame, "vpiid");
  _onAudio = Module.addFunction(function (buff, size, ts) {
    // 确保size是偶数（16位采样）
    const audioData = Module.HEAPU8.slice(buff, buff + size);
    // 创建Int16Array的副本以保持引用
    const int16Data = new Int16Array(audioData.buffer, audioData.byteOffset, size / 2);
    const int16Copy = new Int16Array(int16Data);
    postMessage({
      type: "pcm16",
      frame: int16Copy.buffer,
      sampleRate: 8000,
      channels: 1,
      bitsPerSample: 16
    }, [int16Copy.buffer]);
  }, "vpid");
  logDebug("_jsNewDecoder " + Module._jsNewDecoder(_onVideo, _onAudio));
  _Buffer = Module._malloc(1048576);
  onmessage = (ev) => {
    const data = ev.data;
    if (data.type === "frame") {
      _Module.HEAPU8.set(data.frame, _Buffer);
      _Module._jsDecodec(_Buffer, data.frame.length);
    }
  };
  postMessage({ type: "initialize" });
});
