// Pure geometry helpers for turning pose landmarks into bike-fit angles.
// Landmarks follow the MediaPipe BlazePose 33-point topology (x, y normalized 0-1, z depth).
//
// Field naming mirrors the terminology used in professional bike-fit reports
// (e.g. "Ángulo Torso", "Ángulo Cadera", "Ángulo Rodilla", "Ángulo Pie",
// "Ángulo Hombro-Muñeca"). Every value is a direct, raw geometric angle —
// no complementary (180° - x) transforms — matching the numbers shown in
// professional bike-fit photo overlays (e.g. a knee angle around 143°, not
// a "38° of flexion" derived figure):
// - torso / pie: angle of a body segment relative to horizontal
// - cadera / rodilla / hombroMuneca: joint-included angle (shoulder-hip-knee,
//   hip-knee-ankle, shoulder-elbow-wrist)

export const LM = {
  LEFT_EAR: 7, RIGHT_EAR: 8,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

// Angle at vertex B formed by rays B->A and B->C, in degrees [0, 180].
export function angleAt(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return null;
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Angle of the segment a->b relative to the horizontal image axis, in degrees [0, 90].
export function segmentAngleFromHorizontal(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
}

function avgConfidence(...pts) {
  return pts.reduce((s, p) => s + (p?.visibility ?? 1), 0) / pts.length;
}

// Signed knee-tracking deviation for one leg, viewed from the front: how far
// the knee strays sideways from the straight hip-ankle line, expressed in
// degrees. Positive = the knee moved toward the body's midline (valgus,
// "adentro"); negative = away from it (varus, "afuera"). `towardMidlineSign`
// is +1 or -1 depending on which side of this leg's hip the midline sits on,
// so the same formula works for either leg without hardcoding left/right.
function kneeTrackingDeg(hip, knee, ankle, towardMidlineSign) {
  const dyLine = ankle.y - hip.y;
  const t = dyLine === 0 ? 0 : (knee.y - hip.y) / dyLine;
  const expectedX = hip.x + (ankle.x - hip.x) * t;
  const legLength = Math.hypot(ankle.x - hip.x, ankle.y - hip.y) || 1e-6;
  const inwardOffset = (knee.x - expectedX) * towardMidlineSign;
  return (Math.atan2(inwardOffset, legLength) * 180) / Math.PI;
}

// Front-view counterpart to computeFrameAngles: tracks both legs (a frontal
// camera sees both), since side-profile angles like torso lean or knee
// flexion aren't meaningful from the front. Returns null when either leg's
// landmarks are missing/low-confidence.
export function computeFrontalAngles(landmarks) {
  const pts = {
    leftHip: landmarks[LM.LEFT_HIP], leftKnee: landmarks[LM.LEFT_KNEE], leftAnkle: landmarks[LM.LEFT_ANKLE],
    rightHip: landmarks[LM.RIGHT_HIP], rightKnee: landmarks[LM.RIGHT_KNEE], rightAnkle: landmarks[LM.RIGHT_ANKLE],
  };
  const CONF_MIN = 0.4;
  for (const k in pts) {
    if (!pts[k] || (pts[k].visibility ?? 1) < CONF_MIN) return null;
  }

  const midlineX = (pts.leftHip.x + pts.rightHip.x) / 2;
  const leftSign = midlineX - pts.leftHip.x >= 0 ? 1 : -1;
  const rightSign = midlineX - pts.rightHip.x >= 0 ? 1 : -1;

  return {
    left: kneeTrackingDeg(pts.leftHip, pts.leftKnee, pts.leftAnkle, leftSign),
    right: kneeTrackingDeg(pts.rightHip, pts.rightKnee, pts.rightAnkle, rightSign),
    confidence: avgConfidence(...Object.values(pts)),
    xy: {
      leftHip: { x: pts.leftHip.x, y: pts.leftHip.y },
      leftKnee: { x: pts.leftKnee.x, y: pts.leftKnee.y },
      leftAnkle: { x: pts.leftAnkle.x, y: pts.leftAnkle.y },
      rightHip: { x: pts.rightHip.x, y: pts.rightHip.y },
      rightKnee: { x: pts.rightKnee.x, y: pts.rightKnee.y },
      rightAnkle: { x: pts.rightAnkle.x, y: pts.rightAnkle.y },
    },
  };
}

// Given a landmarks array and which side is facing the camera ("left" | "right"),
// compute the full set of bike-fit angles for that frame. Returns null when
// landmarks are missing/low-confidence rather than throwing.
export function computeFrameAngles(landmarks, side) {
  const s = side === "left" ? "LEFT" : "RIGHT";
  const shoulder = landmarks[LM[`${s}_SHOULDER`]];
  const elbow = landmarks[LM[`${s}_ELBOW`]];
  const wrist = landmarks[LM[`${s}_WRIST`]];
  const hip = landmarks[LM[`${s}_HIP`]];
  const knee = landmarks[LM[`${s}_KNEE`]];
  const ankle = landmarks[LM[`${s}_ANKLE`]];
  const footIndex = landmarks[LM[`${s}_FOOT_INDEX`]];

  const CONF_MIN = 0.4;
  const pts = { shoulder, elbow, wrist, hip, knee, ankle, footIndex };
  for (const k in pts) {
    if (!pts[k] || (pts[k].visibility ?? 1) < CONF_MIN) return null;
  }

  return {
    torso: segmentAngleFromHorizontal(hip, shoulder),
    cadera: angleAt(shoulder, hip, knee),
    rodilla: angleAt(hip, knee, ankle),
    pie: segmentAngleFromHorizontal(ankle, footIndex),
    hombroMuneca: angleAt(shoulder, elbow, wrist),
    confidence: avgConfidence(shoulder, elbow, wrist, hip, knee, ankle, footIndex),
    xy: {
      shoulder: { x: shoulder.x, y: shoulder.y },
      elbow: { x: elbow.x, y: elbow.y },
      wrist: { x: wrist.x, y: wrist.y },
      hip: { x: hip.x, y: hip.y },
      knee: { x: knee.x, y: knee.y },
      ankle: { x: ankle.x, y: ankle.y },
      footIndex: { x: footIndex.x, y: footIndex.y },
    },
  };
}
