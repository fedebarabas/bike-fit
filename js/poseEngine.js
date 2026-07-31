import {
  PoseLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

export class PoseEngine {
  constructor() {
    this.landmarker = null;
    this.video = null;
    this.stream = null;
    this.running = false;
    this.onResult = null; // callback(landmarks[], timestampMs)
  }

  async init() {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }

  async startCamera(videoEl) {
    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: "user" },
      audio: false,
    });
    videoEl.srcObject = this.stream;
    await new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        resolve();
      };
    });
  }

  stopCamera() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  start() {
    if (!this.landmarker || !this.video) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      if (this.video.readyState >= 2) {
        const result = this.landmarker.detectForVideo(this.video, now);
        if (this.onResult) {
          const landmarks = result.landmarks?.[0] ?? null;
          this.onResult(landmarks, now);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }
}
