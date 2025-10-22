import decoder from "./build/video_decode.js";

function currentTimeStr() {
  var now = new Date(Date.now());
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var day = now.getDate();
  var hour = now.getHours();
  var min = now.getMinutes();
  var sec = now.getSeconds();
  var ms = now.getMilliseconds();
  return (
    year +
    "-" +
    month +
    "-" +
    day +
    " " +
    hour +
    ":" +
    min +
    ":" +
    sec +
    ":" +
    ms
  );
}

function logDebug(line) {
  console.log(currentTimeStr() + " " + line);
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
  _onAudio = Module.addFunction(function (buff, size, ts) {}, "vpiid");
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
