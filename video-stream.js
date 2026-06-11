export default class VideoStream {
  constructor(doc) {
    this.worker = null;
    this.audioCtx = null;
    this.videoCtx = null;
    this.ws = null;
    this.id = doc;
    this.wsURL = "";
  }

  connectWS() {
    this.ws = new WebSocket(this.wsURL);
    this.ws.binaryType = "arraybuffer";
    this.ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") {
        const msg = JSON.parse(ev.data);
        console.log(msg);
      } else {
        var frame = new Uint8Array(ev.data);
        this.worker.postMessage({ type: "frame", frame: frame });
      }
    });
    this.ws.addEventListener("open", () => { });
    this.ws.addEventListener("close", () => { });
  }

  oninit() {
    this.worker = new Worker(new URL("./video-worker.js", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (message) => {
      const data = message.data;
      switch (data.type) {
        case "initialize":
          this.connectWS();
          break;
        case "frame":
          if (this.videoCtx == null) {
            const canvas = document.getElementById(this.id);
            canvas.width = data.w;
            canvas.height = data.h;
            this.videoCtx = canvas.getContext("2d");
          }
          console.log(data.ts);
          this.videoCtx.drawImage(data.frame, 0, 0);
          data.frame.close();
          break;
        case "pcm16":
          if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: data.sampleRate });
          }
          const pcmData = new Int16Array(data.frame);
          const audioBuffer = this.audioCtx.createBuffer(
            data.channels,
            pcmData.length / data.channels,
            data.sampleRate
          );
          const chData = audioBuffer.getChannelData(0);
          for (let i = 0; i < pcmData.length; i++) {
            chData[i] = pcmData[i] / 32768;
          }
          const source = this.audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
          break;
      }

    });
  }

  open(wsUrl) {
    this.wsURL = wsUrl;
    this.oninit();
  }

  setRate(r) {
    this.ws.send(JSON.stringify({ speed: r }));
  }
}
