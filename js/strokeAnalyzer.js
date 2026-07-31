// Turns a stream of per-frame angle samples into per-pedal-revolution metrics.
// Strategy: the knee angle is ~periodic, one full extension (max) and one full
// flexion (min) per revolution when watching a single leg from the side. We
// smooth the signal, then detect alternating peaks/troughs with a minimum
// time-separation (derived from a plausible cadence range) so camera jitter
// doesn't get mistaken for extra strokes.

const MIN_CADENCE_RPM = 40;
const MAX_CADENCE_RPM = 130;
const SMOOTHING_WINDOW = 5; // frames

export class StrokeAnalyzer {
  constructor() {
    this.samples = []; // { t, torso, cadera, rodilla, pie, hombroMuneca }
    this.cycles = []; // finished cycles with aggregated metrics
    this._lastExtremumIdx = null;
    this._lastExtremumType = null; // "max" | "min"
    this._pendingMax = null;
    this._pendingMin = null;
  }

  reset() {
    this.samples = [];
    this.cycles = [];
    this._lastExtremumIdx = null;
    this._lastExtremumType = null;
  }

  addSample(sample) {
    this.samples.push(sample);
    this._tryDetectExtrema();
  }

  _smoothedRodilla(i) {
    const half = Math.floor(SMOOTHING_WINDOW / 2);
    const lo = Math.max(0, i - half);
    const hi = Math.min(this.samples.length - 1, i + half);
    let sum = 0, n = 0;
    for (let j = lo; j <= hi; j++) {
      sum += this.samples[j].rodilla;
      n++;
    }
    return sum / n;
  }

  _minSeparationMs() {
    // Half a revolution at the fastest plausible cadence, as a floor between
    // consecutive alternating extrema (max->min or min->max).
    return (60 / MAX_CADENCE_RPM) * 1000 * 0.4;
  }

  _tryDetectExtrema() {
    const n = this.samples.length;
    const half = Math.floor(SMOOTHING_WINDOW / 2);
    // i+1 (the "next" neighbor) also needs a full symmetric smoothing window,
    // which requires samples up to (i+1)+half — i.e. one sample later than
    // what cur alone would need. Evaluating any sooner biases "next" with a
    // truncated window and can mask the extremum right at the turning point.
    const i = n - 2 - half;
    if (i < half) return;

    const cur = this._smoothedRodilla(i);
    const prev = this._smoothedRodilla(i - 1);
    const next = this._smoothedRodilla(i + 1);

    const isLocalMax = cur >= prev && cur >= next;
    const isLocalMin = cur <= prev && cur <= next;
    if (!isLocalMax && !isLocalMin) return;

    const t = this.samples[i].t;
    if (this._lastExtremumIdx !== null) {
      const dt = t - this.samples[this._lastExtremumIdx].t;
      if (dt < this._minSeparationMs()) return; // too close, likely noise
      const sameType =
        (isLocalMax && this._lastExtremumType === "max") ||
        (isLocalMin && this._lastExtremumType === "min");
      if (sameType) {
        // Replace the pending extremum of the same type if this one is more extreme.
        const better = isLocalMax ? cur > this._smoothedRodilla(this._lastExtremumIdx)
                                   : cur < this._smoothedRodilla(this._lastExtremumIdx);
        if (better) {
          this._lastExtremumIdx = i;
        }
        return;
      }
    }

    // We have alternation: min -> max or max -> min. A full cycle is BDC(max) -> TDC(min) -> BDC(max).
    if (isLocalMax) {
      if (this._pendingMin !== null) {
        this._closeCycle(this._pendingMin, i);
      }
      this._pendingMax = i;
    } else {
      this._pendingMin = i;
    }

    this._lastExtremumIdx = i;
    this._lastExtremumType = isLocalMax ? "max" : "min";
  }

  _closeCycle(tdcIdx, bdcIdx) {
    // Use the BDC (knee max extension) sample as the reference "bottom of stroke" reading,
    // and the TDC (knee min / most flexed) sample as "top of stroke".
    const bdc = this.samples[bdcIdx];
    const tdc = this.samples[tdcIdx];
    const cadenceRpm =
      this._pendingMax !== null && this._priorBdcT !== undefined
        ? 60000 / (bdc.t - this._priorBdcT)
        : null;
    this._priorBdcT = bdc.t;

    this.cycles.push({
      bdc,
      tdc,
      cadenceRpm: cadenceRpm && isFinite(cadenceRpm) ? cadenceRpm : null,
    });
  }

  // Aggregate stats across all completed cycles for a given field, reading it
  // off either the bdc or tdc sample.
  stats(field, phase = "bdc") {
    const vals = this.cycles
      .map((c) => c[phase]?.[field])
      .filter((v) => typeof v === "number" && isFinite(v));
    if (vals.length === 0) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    return {
      mean,
      std: Math.sqrt(variance),
      min: Math.min(...vals),
      max: Math.max(...vals),
      n: vals.length,
    };
  }

  cycleCount() {
    return this.cycles.length;
  }
}
