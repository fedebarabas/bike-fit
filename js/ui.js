import { LM } from "./angles.js";

const CONNECTIONS = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
];

const BADGE_COLOR = "#ff8a3d"; // orange, matching the reference report's overlay style

function drawBadge(ctx, x, y, lines) {
  ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
  const paddingX = 8, paddingY = 6, lineH = 16;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const w = Math.max(...widths) + paddingX * 2;
  const h = lineH * lines.length + paddingY * 2;
  const bx = x - w / 2, by = y - h - 10;

  ctx.fillStyle = "rgba(255,138,61,0.9)";
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 6);
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  lines.forEach((l, i) => {
    ctx.fillText(l, bx + paddingX, by + paddingY + lineH * (i + 0.75));
  });

  // small connector dot at the joint
  ctx.fillStyle = BADGE_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSkeleton(ctx, landmarks, width, height, trackedSide, frame) {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const trackedIdx = new Set(
    trackedSide === "left"
      ? [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX]
      : [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX]
  );

  ctx.lineWidth = 3;
  for (const [a, b] of CONNECTIONS) {
    const pa = landmarks[a], pb = landmarks[b];
    if (!pa || !pb) continue;
    const highlighted = trackedIdx.has(a) && trackedIdx.has(b);
    ctx.strokeStyle = highlighted ? BADGE_COLOR : "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }

  landmarks.forEach((p, idx) => {
    if ((p.visibility ?? 1) < 0.4) return;
    ctx.fillStyle = trackedIdx.has(idx) ? BADGE_COLOR : "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, trackedIdx.has(idx) ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!frame) return;
  const { xy } = frame;
  drawBadge(ctx, xy.shoulder.x * width, xy.shoulder.y * height, ["Ángulo Torso", `${frame.torso.toFixed(1)}°`]);
  drawBadge(ctx, xy.hip.x * width, xy.hip.y * height, ["Ángulo Cadera", `${frame.cadera.toFixed(1)}°`]);
  drawBadge(ctx, xy.knee.x * width, xy.knee.y * height, ["Ángulo Rodilla", `${frame.rodilla.toFixed(1)}°`]);
  drawBadge(ctx, xy.ankle.x * width, xy.ankle.y * height, ["Ángulo Pie", `${frame.pie.toFixed(1)}°`]);
  drawBadge(ctx, xy.elbow.x * width, xy.elbow.y * height, ["Hombro-Muñeca", `${frame.hombroMuneca.toFixed(1)}°`]);
}

function fmtTrackingDeg(v) {
  return `${Math.abs(v).toFixed(1)}° ${v >= 0 ? "adentro" : "afuera"}`;
}

// Front-view counterpart to drawSkeleton: highlights both legs (hip-knee-
// ankle on each side) instead of a single tracked side, with badges showing
// each knee's live lateral deviation from the hip-ankle line.
export function drawFrontalSkeleton(ctx, landmarks, width, height, frontal) {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const trackedIdx = new Set([
    LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE,
    LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE,
  ]);

  ctx.lineWidth = 3;
  for (const [a, b] of CONNECTIONS) {
    const pa = landmarks[a], pb = landmarks[b];
    if (!pa || !pb) continue;
    const highlighted = trackedIdx.has(a) && trackedIdx.has(b);
    ctx.strokeStyle = highlighted ? BADGE_COLOR : "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }

  landmarks.forEach((p, idx) => {
    if ((p.visibility ?? 1) < 0.4) return;
    ctx.fillStyle = trackedIdx.has(idx) ? BADGE_COLOR : "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, trackedIdx.has(idx) ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!frontal) return;
  const { xy } = frontal;
  drawBadge(ctx, xy.leftKnee.x * width, xy.leftKnee.y * height, ["Rodilla Izq.", fmtTrackingDeg(frontal.left)]);
  drawBadge(ctx, xy.rightKnee.x * width, xy.rightKnee.y * height, ["Rodilla Der.", fmtTrackingDeg(frontal.right)]);
}

// Draws one stick figure (from averaged joint positions) into the given
// horizontal slice of the canvas, with a caption above it. Returns a mapper
// so the caller can place badges at the right joints in canvas space.
function drawFigureSlice(ctx, avgXY, xOffset, sliceWidth, height, label) {
  const topMargin = 22;
  const mapX = (x) => xOffset + x * sliceWidth;
  const mapY = (y) => topMargin + y * (height - topMargin);

  ctx.fillStyle = "#9aa0a8";
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, xOffset + sliceWidth / 2, 16);
  ctx.textAlign = "left";

  if (!avgXY) return null;
  const p = avgXY;
  const segments = [
    [p.shoulder, p.elbow], [p.elbow, p.wrist],
    [p.shoulder, p.hip], [p.hip, p.knee],
    [p.knee, p.ankle], [p.ankle, p.footIndex],
  ];
  ctx.lineWidth = 3;
  ctx.strokeStyle = BADGE_COLOR;
  for (const [a, b] of segments) {
    ctx.beginPath();
    ctx.moveTo(mapX(a.x), mapY(a.y));
    ctx.lineTo(mapX(b.x), mapY(b.y));
    ctx.stroke();
  }
  Object.values(p).forEach((joint) => {
    ctx.fillStyle = BADGE_COLOR;
    ctx.beginPath();
    ctx.arc(mapX(joint.x), mapY(joint.y), 4, 0, Math.PI * 2);
    ctx.fill();
  });

  return { p, mapX, mapY };
}

// Draws two static stick figures side by side from averaged joint positions
// — one at the bottom of the stroke (PMI, where the knee/foot angles are
// read) and one at the top (PMS, where the hip angle is read) — since a
// single frozen pose can't honestly represent both measurements at once.
// Used as the "pose promedio" view that replaces the live camera feed.
export function drawAveragePose(ctx, width, height, avgXYPmi, avgXYPms, stats) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  if (!avgXYPmi && !avgXYPms) {
    ctx.fillStyle = "#9aa0a8";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Todavía no hay ciclos suficientes", 20, height / 2);
    return;
  }

  const half = width / 2;
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half, height);
  ctx.stroke();

  const fmt = (s) => (s ? `${s.mean.toFixed(1)}°` : "--");

  const pmi = drawFigureSlice(ctx, avgXYPmi, 0, half, height, "PMI — pedal abajo");
  if (pmi) {
    drawBadge(ctx, pmi.mapX(pmi.p.shoulder.x), pmi.mapY(pmi.p.shoulder.y), ["Ángulo Torso", fmt(stats.torso)]);
    drawBadge(ctx, pmi.mapX(pmi.p.knee.x), pmi.mapY(pmi.p.knee.y), ["Ángulo Rodilla (PMI)", fmt(stats.rodillaPmi)]);
    drawBadge(ctx, pmi.mapX(pmi.p.ankle.x), pmi.mapY(pmi.p.ankle.y), ["Ángulo Pie", fmt(stats.pie)]);
    drawBadge(ctx, pmi.mapX(pmi.p.elbow.x), pmi.mapY(pmi.p.elbow.y), ["Hombro-Muñeca", fmt(stats.hombroMuneca)]);
  }

  const pms = drawFigureSlice(ctx, avgXYPms, half, half, height, "PMS — pedal arriba");
  if (pms) {
    drawBadge(ctx, pms.mapX(pms.p.hip.x), pms.mapY(pms.p.hip.y), ["Ángulo Cadera (PMS)", fmt(stats.caderaPms)]);
  }
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Click-to-show info popover for the table's ⓘ icons — a hover-only title
// attribute doesn't work on touch devices, so this shows/hides an actual
// floating tooltip on click instead.
let openTooltipEl = null;
let openTooltipIcon = null;

function closeTooltip() {
  if (openTooltipEl) openTooltipEl.remove();
  openTooltipEl = null;
  openTooltipIcon = null;
}

function toggleTooltip(icon) {
  if (openTooltipIcon === icon) {
    closeTooltip();
    return;
  }
  closeTooltip();
  const bubble = document.createElement("div");
  bubble.className = "info-tooltip";
  bubble.textContent = icon.dataset.info;
  document.body.appendChild(bubble);

  const iconRect = icon.getBoundingClientRect();
  const bubbleRect = bubble.getBoundingClientRect();
  let left = iconRect.left + iconRect.width / 2 - bubbleRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - bubbleRect.width - 8));
  bubble.style.left = `${left}px`;
  bubble.style.top = `${iconRect.bottom + 6}px`;

  openTooltipEl = bubble;
  openTooltipIcon = icon;
}

document.addEventListener("click", (e) => {
  if (e.target.closest(".info-icon") || e.target.closest(".info-tooltip")) return;
  closeTooltip();
});

export function renderTablaBiomecanica(container, filas) {
  const rows = filas.map((f) => `
    <tr class="fila-${f.estado}">
      <td>${f.angulo}</td>
      <td>${f.medido}</td>
      <td>${f.objetivo}</td>
      <td>${f.accion}</td>
      <td><span class="info-icon" data-info="${escapeAttr(f.info)}" role="button" tabindex="0" aria-label="Más información">ⓘ</span></td>
    </tr>
  `).join("");
  container.innerHTML = `
    <table class="tabla-biomecanica">
      <thead><tr><th>Ángulo</th><th>Medido</th><th>Objetivo</th><th>Acción</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  container.querySelectorAll(".info-icon").forEach((icon) => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleTooltip(icon);
    });
    icon.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleTooltip(icon);
      }
    });
  });
}

export class LiveChart {
  constructor(canvas, { yMin = 0, yMax = 180, windowMs = 8000 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.yMin = yMin;
    this.yMax = yMax;
    this.windowMs = windowMs;
    this.points = []; // { t, v }
  }

  push(t, v) {
    this.points.push({ t, v });
    const cutoff = t - this.windowMs;
    while (this.points.length && this.points[0].t < cutoff) this.points.shift();
  }

  draw() {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (this.points.length < 2) return;

    const tMax = this.points[this.points.length - 1].t;
    const tMin = tMax - this.windowMs;

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (const frac of [0.25, 0.5, 0.75]) {
      const y = h * frac;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = BADGE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.points.forEach((p, i) => {
      const x = ((p.t - tMin) / this.windowMs) * w;
      const yFrac = (p.v - this.yMin) / (this.yMax - this.yMin);
      const y = h - Math.min(1, Math.max(0, yFrac)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
}

export function renderRecommendations(container, recs) {
  container.innerHTML = "";
  const orden = { alerta: 0, info: 1, ok: 2 };
  const ordenados = [...recs].sort((a, b) => orden[a.severidad] - orden[b.severidad]);
  for (const rec of ordenados) {
    const card = document.createElement("div");
    card.className = `rec-card rec-${rec.severidad}`;
    const titulo = document.createElement("h3");
    titulo.textContent = rec.titulo;
    const detalle = document.createElement("p");
    detalle.textContent = rec.detalle;
    card.appendChild(titulo);
    card.appendChild(detalle);
    if (rec.sugerencia) {
      const sug = document.createElement("p");
      sug.className = "rec-suggestion";
      sug.textContent = `→ ${rec.sugerencia}`;
      card.appendChild(sug);
    }
    container.appendChild(card);
  }
}

// Composites the video frame + angle overlay into a single image, matching
// what's shown on screen, for use as "Resultado Visual" in the report.
export function captureSnapshot(videoEl, overlayCanvas) {
  const w = overlayCanvas.width, h = overlayCanvas.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, w, h);
  ctx.drawImage(overlayCanvas, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

export function renderReadouts(container, frame) {
  if (!frame) {
    container.textContent = "No se detecta la postura";
    return;
  }
  const campos = [
    ["Torso", frame.torso],
    ["Cadera", frame.cadera],
    ["Rodilla", frame.rodilla],
    ["Pie", frame.pie],
    ["Hombro-Muñeca", frame.hombroMuneca],
  ];
  container.innerHTML = campos
    .map(([label, v]) => `<div class="readout"><span>${label}</span><strong>${v?.toFixed(0) ?? "--"}°</strong></div>`)
    .join("");
}

export function renderReadoutsFrontal(container, frontal) {
  if (!frontal) {
    container.textContent = "No se detecta la postura";
    return;
  }
  const campos = [
    ["Rodilla Izq.", fmtTrackingDeg(frontal.left)],
    ["Rodilla Der.", fmtTrackingDeg(frontal.right)],
  ];
  container.innerHTML = campos
    .map(([label, v]) => `<div class="readout"><span>${label}</span><strong>${v}</strong></div>`)
    .join("");
}
