import { PoseEngine } from "./poseEngine.js";
import { computeFrameAngles, computeFrontalAngles } from "./angles.js";
import { StrokeAnalyzer } from "./strokeAnalyzer.js";
import { construirRecomendaciones, tablaBiomecanica, tablaFrontal } from "./fitRules.js";
import {
  drawSkeleton, LiveChart, renderRecommendations, renderReadouts,
  drawAveragePose, renderTablaBiomecanica,
  drawFrontalSkeleton, renderReadoutsFrontal,
} from "./ui.js";

const videoEl = document.getElementById("video");
const overlayEl = document.getElementById("overlay");
const chartEl = document.getElementById("chart");
const readoutsEl = document.getElementById("readouts");
const recommendationsEl = document.getElementById("recommendations");
const resumenEl = document.getElementById("resumenBiomecanico");
const cycleCountEl = document.getElementById("cycleCount");
const statusEl = document.getElementById("statusLine");
const viewModeSelect = document.getElementById("viewMode");
const sideGroup = document.getElementById("sideGroup");
const styleGroup = document.getElementById("styleGroup");
const sideSelect = document.getElementById("side");
const styleSelect = document.getElementById("style");
const countdownOverlay = document.getElementById("countdownOverlay");
const initialOverlay = document.getElementById("initialOverlay");
const recordingOverlay = document.getElementById("recordingOverlay");
const startBtn = document.getElementById("startBtn");
const toggleMeasureBtn = document.getElementById("toggleMeasureBtn");
const resetBtn = document.getElementById("resetBtn");
const avgPoseBtn = document.getElementById("avgPoseBtn");

const overlayCtx = overlayEl.getContext("2d");
const engine = new PoseEngine();
const analyzer = new StrokeAnalyzer();
const chart = new LiveChart(chartEl, { yMin: 40, yMax: 180, windowMs: 8000 });

let lastCycleCountAtReport = -1;
let showingAverage = false;
let lastAvgXYPmi = null;
let lastAvgXYPms = null;
let lastAvgStats = null;
let warmupActive = false;
let warmupTimer = null;
let warmupDeadline = null;
let measuring = false;
let frontalSamples = { left: [], right: [] };
let frontalFrameCounter = 0;

// Once we have a decent sample and the last few cycles agree with each other
// closely enough across every tracked angle, the average posture has settled
// and there's no point making the rider keep pedaling — stop automatically.
const MIN_CYCLES_AUTOSTOP = 8;
const STABILITY_WINDOW = 5;
const STABILITY_THRESHOLD_DEG = 1.5;

// Fixed on purpose — a configurable value wasn't earning its keep as a control.
const MEASURE_COUNTDOWN_SECONDS = 10;

function setStatus(text) {
  statusEl.textContent = text;
}

function updateRecordingOverlay() {
  recordingOverlay.hidden = !(measuring && !showingAverage);
}

// Lets the rider trigger the countdown themselves once they're on the bike
// and in position — clicking "Empezar medición" (the same button then flips
// to "Detener medición") is what starts it, separate from the camera on/off
// toggle. Nothing counts toward cycle detection (measuring) until the
// countdown finishes, so mounting up/settling in doesn't get recorded as a
// noisy, non-representative stroke.
function clearWarmup() {
  if (warmupTimer) {
    clearInterval(warmupTimer);
    warmupTimer = null;
  }
  warmupActive = false;
  warmupDeadline = null;
  countdownOverlay.hidden = true;
}

// Ticks off an absolute deadline rather than counting down tick-by-tick, so a
// throttled/delayed interval (backgrounded tab, slow frame) can't make the
// warm-up run longer than requested — it just catches up on the next tick.
function updateWarmupDisplay() {
  const remainingMs = warmupDeadline - Date.now();
  if (remainingMs <= 0) {
    clearWarmup();
    measuring = true;
    updateRecordingOverlay();
    setStatus("Rastreando — pedaleá con ritmo constante frente a la cámara");
    return;
  }
  const remaining = Math.ceil(remainingMs / 1000);
  countdownOverlay.textContent = String(remaining);
  setStatus(`Preparate — empieza a medir en ${remaining}s`);
}

function beginMeasuring() {
  // Every "Empezar medición" starts a fully fresh capture — previous cycles
  // don't carry over, so the count and averages always reflect just this run.
  if (showingAverage) toggleAveragePose();
  analyzer.reset();
  frontalSamples = { left: [], right: [] };
  resetResultsUI();

  clearWarmup();
  measuring = false;
  toggleMeasureBtn.textContent = "Detener medición";
  updateRecordingOverlay();
  warmupActive = true;
  warmupDeadline = Date.now() + MEASURE_COUNTDOWN_SECONDS * 1000;
  countdownOverlay.hidden = false;
  updateWarmupDisplay();
  warmupTimer = setInterval(updateWarmupDisplay, 200);
}

// The same button starts measuring ("Empezar medición") or, once armed/
// counting down/measuring, stops just the recording ("Detener medición") —
// the camera itself keeps running, controlled separately by "Iniciar cámara".
function onToggleMeasureClick() {
  if (measuring || warmupActive) {
    stopMeasuring("manual");
  } else {
    beginMeasuring();
  }
}

// The camera itself is a toggle: "Iniciar cámara" starts it, and once
// running the same button reads "Detener cámara" and stops everything.
function onToggleCameraClick() {
  if (engine.running) {
    stop();
  } else {
    start();
  }
}

function resizeOverlay() {
  overlayEl.width = videoEl.clientWidth;
  overlayEl.height = videoEl.clientHeight;
  chartEl.width = chartEl.clientWidth;
  // Resizing a canvas clears it; if we're showing the frozen average pose,
  // nothing else will redraw it on the next frame like the live loop does.
  if (showingAverage) {
    drawAveragePose(overlayCtx, overlayEl.width, overlayEl.height, lastAvgXYPmi, lastAvgXYPms, lastAvgStats);
  }
}
window.addEventListener("resize", resizeOverlay);

function summarize(vals) {
  if (vals.length === 0) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return { mean, std: Math.sqrt(variance), min: Math.min(...vals), max: Math.max(...vals), n: vals.length };
}

function statsFor(field, phase) {
  const vals = analyzer.cycles
    .map((c) => c[phase]?.[field])
    .filter((v) => typeof v === "number" && isFinite(v));
  return summarize(vals);
}

function statsForEither(field) {
  const vals = [];
  for (const c of analyzer.cycles) {
    if (typeof c.bdc?.[field] === "number") vals.push(c.bdc[field]);
    if (typeof c.tdc?.[field] === "number") vals.push(c.tdc[field]);
  }
  return summarize(vals);
}

function computeAggregateStats() {
  return {
    rodillaPmi: statsFor("rodilla", "bdc"),
    caderaPms: statsFor("cadera", "tdc"),
    torso: statsForEither("torso"),
    hombroMuneca: statsForEither("hombroMuneca"),
    pie: statsForEither("pie"),
  };
}

// Averages each tracked joint's normalized position across every captured
// cycle's bottom-of-stroke (PMI) sample, for the "pose promedio" stick figure.
function averageXY(phase) {
  const joints = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle", "footIndex"];
  const sums = {};
  joints.forEach((j) => (sums[j] = { x: 0, y: 0 }));
  let n = 0;
  for (const c of analyzer.cycles) {
    const s = c[phase];
    if (!s?.xy) continue;
    n++;
    joints.forEach((j) => {
      sums[j].x += s.xy[j].x;
      sums[j].y += s.xy[j].y;
    });
  }
  if (n === 0) return null;
  const avg = {};
  joints.forEach((j) => (avg[j] = { x: sums[j].x / n, y: sums[j].y / n }));
  return avg;
}

// True once we have enough cycles and the last few agree closely across
// every tracked angle (knee extension at PMI, hip at PMS, torso, arm).
function isPostureStable() {
  if (analyzer.cycleCount() < MIN_CYCLES_AUTOSTOP) return false;
  const recent = analyzer.cycles.slice(-STABILITY_WINDOW);
  if (recent.length < STABILITY_WINDOW) return false;

  const metricSets = [
    recent.map((c) => c.bdc?.rodilla),
    recent.map((c) => c.tdc?.cadera),
    recent.flatMap((c) => [c.bdc?.torso, c.tdc?.torso]),
    recent.flatMap((c) => [c.bdc?.hombroMuneca, c.tdc?.hombroMuneca]),
  ];

  return metricSets.every((vals) => {
    const nums = vals.filter((v) => typeof v === "number" && isFinite(v));
    if (nums.length < 2) return true; // not enough readings to judge — don't block on it
    return summarize(nums).std <= STABILITY_THRESHOLD_DEG;
  });
}

function stopMeasuring(reason) {
  clearWarmup();
  measuring = false;
  toggleMeasureBtn.textContent = "Empezar medición";
  updateRecordingOverlay();

  const n = isFrontalMode() ? Math.max(frontalSamples.left.length, frontalSamples.right.length) : analyzer.cycleCount();
  setStatus(
    reason === "stable"
      ? `Postura estabilizada — medición completa tras ${n} pedaladas.`
      : `Medición detenida tras ${n} pedaladas.`
  );

  // Jump straight to the frozen average-pose review — that's the whole point
  // of finishing a measurement in Perfil mode. Frontal mode has no such view;
  // its result is already the live table.
  if (!isFrontalMode() && !showingAverage && analyzer.cycleCount() > 0) {
    toggleAveragePose();
  }
}

function updateReport() {
  const n = analyzer.cycleCount();
  cycleCountEl.textContent = n > 0 ? `(${n} pedaladas capturadas)` : "";
  avgPoseBtn.disabled = n === 0;
  if (n === 0) return;
  const stats = computeAggregateStats();
  const recs = construirRecomendaciones(stats, styleSelect.value);
  renderRecommendations(recommendationsEl, recs);
  const filas = tablaBiomecanica(stats, styleSelect.value);
  renderTablaBiomecanica(resumenEl, filas);
}

function isFrontalMode() {
  return viewModeSelect.value === "frontal";
}

function computeFrontalStats() {
  return { left: summarize(frontalSamples.left), right: summarize(frontalSamples.right) };
}

function updateReportFrontal() {
  const n = Math.max(frontalSamples.left.length, frontalSamples.right.length);
  cycleCountEl.textContent = n > 0 ? `(${n} cuadros analizados)` : "";
  if (n === 0) return;
  const filas = tablaFrontal(computeFrontalStats());
  renderTablaBiomecanica(resumenEl, filas);
}

// Placeholder text + result panels differ by mode; shared by mode switches
// and session resets so both stay in sync with whichever view is active.
function resetResultsUI() {
  lastCycleCountAtReport = -1;
  cycleCountEl.textContent = "";
  avgPoseBtn.disabled = true;
  if (isFrontalMode()) {
    resumenEl.innerHTML = "<p class=\"muted\">Iniciá la cámara y pedaleá de frente para ver el seguimiento de rodilla.</p>";
    recommendationsEl.textContent = "";
  } else {
    resumenEl.innerHTML = "<p class=\"muted\">Iniciá la cámara y pedaleá algunas vueltas frente a ella para obtener el resumen.</p>";
    recommendationsEl.textContent = "Iniciá la cámara y pedaleá algunas vueltas frente a ella para obtener las consideraciones.";
  }
}

function onViewModeChange() {
  const frontal = isFrontalMode();
  sideGroup.style.display = frontal ? "none" : "";
  styleGroup.style.display = frontal ? "none" : "";
  chartEl.style.display = frontal ? "none" : "";
  avgPoseBtn.style.display = frontal ? "none" : "";
  if (frontal && showingAverage) toggleAveragePose();
  analyzer.reset();
  frontalSamples = { left: [], right: [] };
  resetResultsUI();
  resizeOverlay();
}

function onPoseResultFrontal(landmarks) {
  const frontal = landmarks ? computeFrontalAngles(landmarks) : null;
  drawFrontalSkeleton(overlayCtx, landmarks, overlayEl.width, overlayEl.height, frontal);
  renderReadoutsFrontal(readoutsEl, frontal);

  if (!frontal || !measuring) return;

  frontalSamples.left.push(frontal.left);
  frontalSamples.right.push(frontal.right);

  // Rebuilding the table every frame at ~30fps is wasted work for a value
  // that only shifts a fraction of a degree frame to frame — a few times a
  // second is plenty to feel live.
  frontalFrameCounter++;
  if (frontalFrameCounter % 5 === 0) updateReportFrontal();
}

function onPoseResultPerfil(landmarks, tMs) {
  const side = sideSelect.value;
  const frame = landmarks ? computeFrameAngles(landmarks, side) : null;

  if (!showingAverage) {
    drawSkeleton(overlayCtx, landmarks, overlayEl.width, overlayEl.height, side, frame);
    renderReadouts(readoutsEl, frame);
  }

  if (!frame) return;

  if (!showingAverage) {
    chart.push(tMs, frame.rodilla);
    chart.draw();
  }

  if (!measuring) return;

  analyzer.addSample({
    t: tMs,
    torso: frame.torso,
    cadera: frame.cadera,
    rodilla: frame.rodilla,
    pie: frame.pie,
    hombroMuneca: frame.hombroMuneca,
    xy: frame.xy,
  });

  if (analyzer.cycleCount() !== lastCycleCountAtReport) {
    lastCycleCountAtReport = analyzer.cycleCount();
    updateReport();
    if (isPostureStable()) stopMeasuring("stable");
  }
}

function onPoseResult(landmarks, tMs) {
  if (isFrontalMode()) {
    onPoseResultFrontal(landmarks);
  } else {
    onPoseResultPerfil(landmarks, tMs);
  }
}

async function start() {
  startBtn.disabled = true;
  setStatus("Solicitando cámara…");
  try {
    await engine.startCamera(videoEl);
    resizeOverlay();
    setStatus("Cargando modelo de postura…");
    if (!engine.landmarker) await engine.init();
    engine.onResult = onPoseResult;
    engine.start();
    startBtn.disabled = false;
    startBtn.textContent = "Detener cámara";
    initialOverlay.hidden = true;
    resetBtn.disabled = false;
    toggleMeasureBtn.disabled = false;
    toggleMeasureBtn.textContent = "Empezar medición";
    setStatus('Cámara lista — presioná "Empezar medición" cuando estés en posición y listo para pedalear.');
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
    startBtn.disabled = false;
  }
}

function stop() {
  engine.stop();
  engine.stopCamera();
  clearWarmup();
  measuring = false;
  updateRecordingOverlay();
  initialOverlay.hidden = false;
  startBtn.disabled = false;
  startBtn.textContent = "Iniciar cámara";
  toggleMeasureBtn.disabled = true;
  toggleMeasureBtn.textContent = "Empezar medición";
  setStatus("Detenido");
}

function reset() {
  analyzer.reset();
  frontalSamples = { left: [], right: [] };
  resetResultsUI();
  if (showingAverage) toggleAveragePose();
  clearWarmup();
  measuring = false;
  updateRecordingOverlay();
  toggleMeasureBtn.textContent = "Empezar medición";
  if (engine.running) {
    toggleMeasureBtn.disabled = false;
    setStatus('Sesión reiniciada — presioná "Empezar medición" cuando estés listo.');
  } else {
    toggleMeasureBtn.disabled = true;
    setStatus("Inactivo");
  }
}

function toggleAveragePose() {
  showingAverage = !showingAverage;
  if (showingAverage) {
    lastAvgXYPmi = averageXY("bdc");
    lastAvgXYPms = averageXY("tdc");
    lastAvgStats = computeAggregateStats();
    drawAveragePose(overlayCtx, overlayEl.width, overlayEl.height, lastAvgXYPmi, lastAvgXYPms, lastAvgStats);
    videoEl.style.visibility = "hidden";
    avgPoseBtn.textContent = "Volver a cámara en vivo";
  } else {
    videoEl.style.visibility = "visible";
    avgPoseBtn.textContent = "Ver pose promedio";
  }
  updateRecordingOverlay();
}

startBtn.addEventListener("click", onToggleCameraClick);
resetBtn.addEventListener("click", reset);
toggleMeasureBtn.addEventListener("click", onToggleMeasureClick);
avgPoseBtn.addEventListener("click", toggleAveragePose);
styleSelect.addEventListener("change", updateReport);
viewModeSelect.addEventListener("change", onViewModeChange);

resizeOverlay();
