export default class VideoStream {
  constructor(doc) {
    this.worker = null;
    this.frames = [];
    this.ctx = null;
    this.ws = null;
    this.canvas = null;
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
    this.ws.addEventListener("open", () => {});
    this.ws.addEventListener("close", () => {});
  }

  oninit() {
    this.worker = new Worker(new URL("./video-worker.js", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", (message) => {
      const data = message.data;
      if (data.type == "initialize") {
        console.log("initialize");
        this.connectWS();
        return;
      }
      if (this.canvas == null) {
        this.canvas = document.getElementById(this.id);
        this.ctx = canvas.getContext("2d");
        this.canvas.width = data.w;
        this.canvas.height = data.h;
      }
      console.log(data.ts);
      this.ctx.drawImage(data.frame, 0, 0);
      data.frame.close();
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
