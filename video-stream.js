export default class VideoStream {
  constructor(doc) {
    this.worker = null;
    this.audioCtx = null;
    this.videoCtx = null;
    this.ws = null;
    this.id = doc;
    this.wsURL = "";
    this.oninit();
  }

  connectWS() {
    this.ws = new WebSocket(this.wsURL);
    this.ws.binaryType = "arraybuffer";
    this.ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") {
        const msg = JSON.parse(ev.data);
        console.log(msg);
      } else {
        const buf = ev.data;
        const frame = new Uint8Array(buf);
        if (frame.length <= 8 || frame[2] === 2) {
          return;
        }
        const payload = frame.slice(8);
        this.worker.postMessage({ type: "frame", frame: payload }, [payload.buffer]);
      }
    });
    this.ws.addEventListener("open", () => {
      console.log("WebSocket connected");
      if (this.onOpen) {
        this.onOpen();
      }
      if (this.onStatusChange) {
        this.onStatusChange("WebSocket 连接成功");
      }
    });

    this.ws.addEventListener("close", () => {
      console.log("WebSocket closed");
      if (this.onClose) {
        this.onClose();
      }
      if (this.onStatusChange) {
        this.onStatusChange("连接已关闭");
      }
    });

    this.ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
      if (this.onError) {
        this.onError(error);
      }
      if (this.onStatusChange) {
        this.onStatusChange("连接错误");
      }
    });
  }

  oninit() {
    this.worker = new Worker(new URL("./video-worker.js", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (message) => {
      const data = message.data;
      switch (data.type) {
        case "initialize":
          break;
        case "frame":
          if (this.videoCtx == null) {
            const canvas = document.getElementById(this.id);
            canvas.width = data.w;
            canvas.height = data.h;
            this.videoCtx = canvas.getContext("2d");
          }
          this.videoCtx.drawImage(data.frame, 0, 0);
          data.frame.close();
          break;
        case "pcm16":
          try {
            if (!this.audioCtx) {
              this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: "interactive"
              });
            }
            if (this.audioCtx.state === "suspended") {
              this.audioCtx.resume();
            }

            // 确保data.frame是ArrayBuffer
            let audioBuffer_data = data.frame;
            if (!(audioBuffer_data instanceof ArrayBuffer)) {
              audioBuffer_data = audioBuffer_data.buffer || audioBuffer_data;
            }

            const pcm = new Int16Array(audioBuffer_data);
            const channels = data.channels || 1;
            const sampleRate = data.sampleRate || 8000;
            const samplesPerChannel = pcm.length / channels;

            const audioBuffer = this.audioCtx.createBuffer(
              channels,
              samplesPerChannel,
              sampleRate
            );

            // 快速转换
            const out = audioBuffer.getChannelData(0);
            for (let i = 0; i < pcm.length; i++) {
              out[i] = pcm[i] / 32768;
            }

            const source = this.audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioCtx.destination);
            const now = this.audioCtx.currentTime;

            // 首包
            if (!this._audioStarted) {
              this._nextAudioTime = now + 0.05; // 缓冲50ms
              this._audioStarted = true;
            }

            // 防止累计延迟
            if (this._nextAudioTime < now) {
              this._nextAudioTime = now + 0.02;
            }

            source.start(this._nextAudioTime);
            this._nextAudioTime += audioBuffer.duration;
            source.onended = () => {
              source.disconnect();
            };
          } catch (error) {
            console.error("PCM playback error:", error);
          }

          break;
      }

    });
  }

  open(wsUrl) {
    this.wsURL = wsUrl;
    this.connectWS();
  }

  sendCommand(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      let json = JSON.stringify(command);
      let jsonBytes = new TextEncoder().encode(json);
      let jsonLength = jsonBytes.length;

      // 创建完整的数据包：原始data + 4字节JSON长度 + JSON内容
      let data = new Uint8Array(jsonLength + 8);

      // 写入原始头部
      data[0] = 0x48;
      data[1] = 0x01;
      data[2] = 0x02;
      data[3] = 0x00;

      // 写入4字节JSON长度（大端序）
      data[7] = (jsonLength >> 24) & 0xff;
      data[6] = (jsonLength >> 16) & 0xff;
      data[5] = (jsonLength >> 8) & 0xff;
      data[4] = jsonLength & 0xff;

      // 写入JSON内容
      data.set(jsonBytes, 8);

      this.ws.send(data);
      return true;
    }
    return false;
  }
}
