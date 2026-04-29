import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { Points } from "@ixfx/geometry.js";

// Settings
const settings = Object.freeze({
  trackH: 52,
  trackGap: 6,
  padX: 28,
  physics: Object.freeze({
    razor: Object.freeze({
      pullX: 0.98, frictionX: 0.62,
      pullY: 0.09, frictionY: 0.02,
      weight: 8,
      noise: 0,
    }),
    scissors: Object.freeze({
      pullX: 0.66, frictionX: 0.65,
      pullY: 0.66, frictionY: 0.65,
      weight: 10,
      noise: 0.55,
    }),
  }),
  initialTracks: Object.freeze([
    Object.freeze([
      Object.freeze({ left: 0.03, right: 0.27, hue: 210 }),
      Object.freeze({ left: 0.32, right: 0.60, hue: 210 }),
      Object.freeze({ left: 0.65, right: 0.96, hue: 210 }),
    ]),
  ]),
});

// State
// Each clip: { left: {frac,t}[], right: {frac,t}[], hue }
// Edges always run from t=0 to t=1 (top to bottom of track)
let state = {
  blend: 0,
  pointerIn: false,
  pressing: false,
  realX: 0, realY: 0,
  virtX: 0, virtY: 0,
  velX: 0, velY: 0,
  virtInit: false,
  noiseT: 0,
  canvasW: 0, canvasH: 0,
  timelineTop: 0,
  tracks: settings.initialTracks.map(track => track.map(c => ({
    // Straight vertical edges stored as top+bottom points
    left: [ { frac: c.left, t: 0 }, { frac: c.left, t: 1 } ],
    right: [ { frac: c.right, t: 0 }, { frac: c.right, t: 1 } ],
    hue: c.hue,
  }))
  ),
  /** @type {{x: number, y: number}[]} */
  cutPath: [],
};

const saveState = (patch) => {
  state = { ...state, ...patch };
};

let cutAverager = null;
const canvasElement = /** @type {HTMLCanvasElement} */ (document.getElementById(`c`));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvasElement.getContext(`2d`));

// Resize
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvasElement.style.width = width + `px`;
  canvasElement.style.height = height + `px`;
  canvasElement.width = width * dpr;
  canvasElement.height = height * dpr;
  ctx.scale(dpr, dpr);
  const toolbar = document.getElementById(`toolbar`);
  const tbH = toolbar?.offsetHeight ?? 0;
  const { trackH, trackGap } = settings;
  const totalH = state.tracks.length * trackH + (state.tracks.length - 1) * trackGap;
  const visibleH = height - tbH;
  saveState({ canvasW: width, canvasH: height, timelineTop: tbH + (visibleH - totalH) / 2 });
}
resize();
window.addEventListener(`resize`, resize);

// Geometry helpers
const trackTop = (i) => state.timelineTop + i * (settings.trackH + settings.trackGap);
const trackW = () => state.canvasW - settings.padX * 2;
const toFrac = (x) => Numbers.scale(x, settings.padX, settings.padX + trackW(), 0, 1);
const fromFrac = (f) => Numbers.scale(f, 0, 1, settings.padX, settings.padX + trackW());

function trackAtY(y) {
  for (let i = 0; i < state.tracks.length; i++) {
    if (y >= trackTop(i) && y <= trackTop(i) + settings.trackH) return i;
  }
  return -1;
}

function interpPhysics(blend) {
  const r = settings.physics.razor;
  const s = settings.physics.scissors;
  const lerp = (a, b) => Numbers.interpolate(blend, a, b);
  return {
    pullX: lerp(r.pullX, s.pullX),
    frictionX: lerp(r.frictionX, s.frictionX),
    pullY: lerp(r.pullY, s.pullY),
    frictionY: lerp(r.frictionY, s.frictionY),
    weight: lerp(r.weight, s.weight),
    noise: lerp(r.noise, s.noise),
  };
}

// ─── Cut logic ───────────────────────────────────────────────────────────────

/**
 * Convert the freehand cutPath into an edge for a specific track.
 * Filters points within the track's y bounds, maps to {frac, t},
 * then ALWAYS pads to t=0 and t=1 so the edge spans the full track height.
 * This is what prevents the weird deformation — edges must always be full height.
 */
function cutEdgeForTrack(cutPath, ti) {
  const topY = trackTop(ti);
  const botY = topY + settings.trackH;

  // Only keep points inside this track
  const inside = cutPath
    .filter(p => p.y >= topY && p.y <= botY)
    .map(p => ({
      frac: Numbers.clamp(toFrac(p.x), 0, 1),
      t: (p.y - topY) / settings.trackH,
    }));

  if (inside.length < 2) return null;

  // Pad to full height: extend first point to t=0, last to t=1
  // keeping their frac values (straight up/down from where the cut started/ended)
  const padded = [
    { frac: inside[0].frac, t: 0 },
    ...inside,
    { frac: inside.at(-1).frac, t: 1 },
  ];

  return padded;
}

/**
 * Apply the current cutPath to all tracks.
 * Splits any clip the cut passes through into two clips — left piece and right piece.
 */
function applyCut() {
  const { cutPath } = state;
  if (cutPath.length < 2) {
    saveState({ cutPath: [] }); return;
  }

  const tracks = state.tracks.map((track, ti) => {
    const cutEdge = cutEdgeForTrack(cutPath, ti);
    if (!cutEdge) return track;

    // The cut's x position at the top and bottom of the track
    const cutFracTop = cutEdge[0].frac;
    const cutFracBot = cutEdge.at(-1).frac;

    return track.flatMap(clip => {
      const clipLeftTop = clip.left[0].frac;
      const clipRightTop = clip.right[0].frac;
      const clipLeftBot = clip.left.at(-1).frac;
      const clipRightBot = clip.right.at(-1).frac;

      const margin = 0.005;
      const hitsTop = cutFracTop > clipLeftTop + margin && cutFracTop < clipRightTop - margin;
      const hitsBot = cutFracBot > clipLeftBot + margin && cutFracBot < clipRightBot - margin;

      // Cut doesn't cross this clip — leave it alone
      if (!hitsTop && !hitsBot) return [ clip ];

      // Split into left piece and right piece along the cut edge
      return [
        { left: clip.left, right: cutEdge, hue: clip.hue },
        { left: cutEdge, right: clip.right, hue: clip.hue },
      ];
    });
  });

  saveState({ tracks, cutPath: [] });
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

function drawTimeline() {
  const { tracks } = state;
  const { padX, trackH } = settings;
  const tw = trackW();

  for (let ti = 0; ti < tracks.length; ti++) {
    const ty = trackTop(ti);

    // Track background
    ctx.fillStyle = `#292929`;
    ctx.beginPath();
    ctx.roundRect(padX, ty, tw, trackH, 3);
    ctx.fill();

    // Clip to track bounds so clips don't overflow
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(padX, ty, tw, trackH, 3);
    ctx.clip();

    for (const clip of tracks[ti]) {
      // Draw clip as polygon: left edge top→bottom, right edge bottom→top
      ctx.beginPath();
      ctx.moveTo(fromFrac(clip.left[0].frac), ty + clip.left[0].t * trackH);
      for (let i = 1; i < clip.left.length; i++) {
        ctx.lineTo(fromFrac(clip.left[i].frac), ty + clip.left[i].t * trackH);
      }
      for (let i = clip.right.length - 1; i >= 0; i--) {
        ctx.lineTo(fromFrac(clip.right[i].frac), ty + clip.right[i].t * trackH);
      }
      ctx.closePath();
      ctx.fillStyle = `#F76FA4`;
      ctx.strokeStyle = `#f3367f`;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawCursor() {
  const { pointerIn, pressing, blend, virtX, virtY, canvasW, tracks } = state;
  const { padX, trackH } = settings;
  if (!pointerIn) return;

  const onTrack = trackAtY(virtY) >= 0;

  ctx.save();

  // Horizontal guide line (razor mode only)
  if (!pressing) {
    const guideAlpha = 0.05 * (1 - blend);
    if (guideAlpha > 0.001) {
      ctx.strokeStyle = `rgba(255,255,255,${guideAlpha})`;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([ 2, 10 ]);
      ctx.beginPath();
      ctx.moveTo(padX, virtY);
      ctx.lineTo(canvasW - padX, virtY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw cut path while pressing
  if (pressing && state.cutPath.length > 1) {
    ctx.strokeStyle = `rgba(255,255,255,0.88)`;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = `round`;
    ctx.lineCap = `round`;
    ctx.beginPath();
    ctx.moveTo(state.cutPath[0].x, state.cutPath[0].y);
    for (let i = 1; i < state.cutPath.length; i++) ctx.lineTo(state.cutPath[i].x, state.cutPath[i].y);
    ctx.stroke();
  }

  // Vertical guide line per track when hovering
  if (!pressing && onTrack) {
    ctx.strokeStyle = `rgba(255,255,255,0.48)`;
    ctx.lineWidth = 1;
    for (let ti = 0; ti < tracks.length; ti++) {
      const ty = trackTop(ti);
      ctx.beginPath();
      ctx.moveTo(virtX, ty + 2);
      ctx.lineTo(virtX, ty + trackH - 2);
      ctx.stroke();
    }
  }

  // Cursor dot
  const dotRadius = pressing ? 2.5 : 3;
  const dotAlpha = pressing ? 0.95 : 0.52;
  ctx.beginPath();
  ctx.arc(virtX, virtY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${dotAlpha})`;
  ctx.fill();

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, state.canvasW, state.canvasH);
  drawTimeline();
  drawCursor();
  drawDebug();
}

// ─── Physics update ───────────────────────────────────────────────────────────

function update() {
  const { pointerIn, virtInit, realX, realY, virtX, virtY,
    velX, velY, pressing, noiseT, blend } = state;
  if (!pointerIn) return;

  if (!virtInit) {
    saveState({ virtX: realX, virtY: realY, virtInit: true });
    return;
  }

  const ph = interpPhysics(blend);

  let newVelX = velX + (realX - virtX) * ph.pullX / ph.weight;
  let newVelY = velY + (realY - virtY) * ph.pullY / ph.weight;
  newVelX *= (1 - ph.frictionX);
  newVelY *= (1 - ph.frictionY);

  let newNoiseT = noiseT;
  if (ph.noise > 0) {
    newNoiseT += 0.11;
    const n = Math.sin(newNoiseT * 2.7) * Math.cos(newNoiseT * 0.9 + 1.3);
    newVelY += n * ph.noise * 0.22;
    newVelX += (Math.random() - 0.5) * ph.noise * 0.04;
  }

  const newVirtX = virtX + newVelX;
  const newVirtY = virtY + newVelY;

  let newCutPath = state.cutPath;
  if (pressing && cutAverager) {
    const averaged = cutAverager({ x: newVirtX, y: newVirtY });
    const last = newCutPath.at(-1);
    if (!last || Points.distance(averaged, last) > 1.5) {
      newCutPath = [ ...newCutPath, averaged ];
    }
  }

  saveState({ virtX: newVirtX, virtY: newVirtY, velX: newVelX, velY: newVelY,
    noiseT: newNoiseT, cutPath: newCutPath });
}

// ─── Main loop ────────────────────────────────────────────────────────────────

continuously(() => {
  update(); draw();
}).start();

// ─── Debug ────────────────────────────────────────────────────────────────────

const debugEl = document.getElementById(`debug`);
function drawDebug() {
  if (!debugEl) return;
  const ph = interpPhysics(state.blend);
  const f2 = (n) => n.toFixed(2);
  debugEl.textContent =
    `pull X:${f2(ph.pullX)} / Y:${f2(ph.pullY)}\n` +
    `friction X:${f2(ph.frictionX)} / Y:${f2(ph.frictionY)}\n` +
    `weight ${f2(ph.weight)}\n` +
    `noise ${f2(ph.noise)}`;
}

// ─── Pointer events ───────────────────────────────────────────────────────────

const isValidPointer = (e) => e.pointerType === `mouse` || e.pointerType === `pen`;

canvasElement.addEventListener(`pointermove`, (e) => {
  if (!isValidPointer(e)) return;
  saveState({ realX: e.offsetX, realY: e.offsetY, pointerIn: true });
});

canvasElement.addEventListener(`pointerenter`, (e) => {
  if (!isValidPointer(e)) return;
  saveState({ realX: e.offsetX, realY: e.offsetY, pointerIn: true, virtInit: false });
});

canvasElement.addEventListener(`pointerdown`, (e) => {
  if (!isValidPointer(e)) return;
  e.preventDefault();
  cutAverager = Points.averager(`moving-average-light`, {});
  saveState({
    realX: e.offsetX, realY: e.offsetY,
    pressing: true,
    virtInit: true,
    cutPath: [ { x: state.virtX, y: state.virtY } ],
  });
});

canvasElement.addEventListener(`pointerup`, (e) => {
  if (!isValidPointer(e)) return;
  if (state.pressing) applyCut();
  cutAverager = null;
  saveState({ pressing: false, cutPath: [] });
});

canvasElement.addEventListener(`pointerleave`, (e) => {
  if (!isValidPointer(e)) return;
  cutAverager = null;
  saveState({ pointerIn: false, pressing: false, cutPath: [] });
});

canvasElement.addEventListener(`contextmenu`, (e) => e.preventDefault());

// ─── Toolbar ──────────────────────────────────────────────────────────────────

document.getElementById(`blend-slider`)?.addEventListener(`input`, (e) => {
  const blend = Number(/** @type {HTMLInputElement} */ (e.target).value) / 100;
  saveState({ blend, velX: 0, velY: 0 });
});