import { continuously } from "@ixfx/flow.js";
import * as Numbers from "@ixfx/numbers.js";
import { Points } from "@ixfx/geometry.js";

const settings = Object.freeze({
  trackH: 52,
  trackGap: 20,
  padX: 28,

  tools: Object.freeze({
    razor: Object.freeze({ pullX: 0.98, frictionX: 0.62, pullY: 0.09, frictionY: 0.02, weight: 8, noise: 0 }),
    scissors: Object.freeze({ pullX: 0.66, frictionX: 0.65, pullY: 0.66, frictionY: 0.65, weight: 10, noise: 0.55 }),
  }),

  materials: Object.freeze({
    light: Object.freeze({ pullMat: 1.18, weightMat: 0.50, noiseMat: 0.20, baseNoise: 0.00, fill: `#F76FA4`, stroke: `#f3367f` }),
    thick: Object.freeze({ pullMat: 0.15, weightMat: 2.0, noiseMat: 1.80, baseNoise: 0.28, fill: `#E8914A`, stroke: `#c26420` }),
    springy: Object.freeze({ pullMat: 1.4, weightMat: 0.80, noiseMat: 8.00, baseNoise: 0.00, fill: `#4DC9A0`, stroke: `#1fa678` }),
  }),

  initialTracks: Object.freeze([
    Object.freeze({ material: `light`, clips: Object.freeze([
      Object.freeze({ left: 0.03, right: 0.27 }),
      Object.freeze({ left: 0.32, right: 0.60 }),
      Object.freeze({ left: 0.65, right: 0.96 }),
    ]) }),
    Object.freeze({ material: `thick`, clips: Object.freeze([
      Object.freeze({ left: 0.03, right: 0.38 }),
      Object.freeze({ left: 0.43, right: 0.96 }),
    ]) }),
    Object.freeze({ material: `springy`, clips: Object.freeze([
      Object.freeze({ left: 0.03, right: 0.20 }),
      Object.freeze({ left: 0.25, right: 0.48 }),
      Object.freeze({ left: 0.53, right: 0.73 }),
      Object.freeze({ left: 0.78, right: 0.96 }),
    ]) }),
  ]),
});

let state = {
  blend: 0,
  pointerIn: false,
  pressing: false,
  realX: 0, realY: 0,
  virtX: 0, virtY: 0,
  velX: 0, velY: 0,
  noiseT: 0,
  canvasW: 0, canvasH: 0,
  timelineTop: 0,
  tracks: settings.initialTracks.map(t => ({
    material: t.material,
    clips: t.clips.map(c => ({ left: c.left, right: c.right, marks: [] })),
  })),
  currentMark: [],
};

const saveState = (patch) => {
  state = { ...state, ...patch };
};

// @ts-ignore
const canvas = document.getElementById(`c`);
// @ts-ignore
const ctx = canvas.getContext(`2d`);

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  // @ts-ignore
  canvas.style.width = width + `px`;
  // @ts-ignore
  canvas.style.height = height + `px`;
  // @ts-ignore
  canvas.width = width * dpr;
  // @ts-ignore
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const toolbar = document.getElementById(`toolbar`)?.offsetHeight ?? 0;
  const { trackH, trackGap } = settings;
  const totalH = state.tracks.length * (trackH + trackGap) - trackGap;
  const visibleH = height - toolbar;
  saveState({ canvasW: width, canvasH: height, timelineTop: toolbar + (visibleH - totalH) / 2 });
}
resize();
window.addEventListener(`resize`, resize);

const trackTop = (i) => state.timelineTop + i * (settings.trackH + settings.trackGap);
const trackW = () => state.canvasW - settings.padX * 2;
const fromFrac = (f) => Numbers.scale(f, 0, 1, settings.padX, settings.padX + trackW());

function trackAtY(y) {
  for (let i = 0; i < state.tracks.length; i++) {
    if (y >= trackTop(i) && y <= trackTop(i) + settings.trackH) return i;
  }
  return -1;
}

function interpTools(blend) {
  const { razor: r, scissors: s } = settings.tools;
  const interp = (a, b) => Numbers.interpolate(blend, a, b);
  return {
    pullX: interp(r.pullX, s.pullX),
    frictionX: interp(r.frictionX, s.frictionX),
    pullY: interp(r.pullY, s.pullY),
    frictionY: interp(r.frictionY, s.frictionY),
    weight: interp(r.weight, s.weight),
    noise: interp(r.noise, s.noise),
  };
}

function getPhysics(blend, materialKey) {
  const base = interpTools(blend);
  const m = materialKey ? settings.materials[materialKey] : null;
  if (!m) return base;
  return {
    pullX: base.pullX * m.pullMat,
    frictionX: base.frictionX,
    pullY: base.pullY * m.pullMat,
    frictionY: base.frictionY,
    weight: base.weight * m.weightMat,
    noise: base.noise * m.noiseMat + m.baseNoise,
  };
}

function applyNoise(velX, velY, noiseT, noise) {
  const t = noiseT + 0.11;
  const n = Math.sin(t * 2.7) * Math.cos(t * 0.9 + 1.3);
  return {
    velX: velX + (Math.random() - 0.5) * noise * 0.04,
    velY: velY + n * noise * 0.22,
    noiseT: t,
  };
}

function saveMarkToClips(stroke) {
  if (stroke.length < 2) return;
  const tracks = state.tracks.map((track, ti) => {
    const topY = trackTop(ti);
    const botY = topY + settings.trackH;
    const clips = track.clips.map(clip => {
      const leftX = fromFrac(clip.left);
      const rightX = fromFrac(clip.right);
      const touches = stroke.some(pt => pt.x >= leftX && pt.x <= rightX && pt.y >= topY && pt.y <= botY);
      if (!touches) return clip;
      return { ...clip, marks: [ ...clip.marks, stroke ] };
    });
    return { ...track, clips };
  });
  saveState({ tracks });
}

function drawTimeline() {
  const { tracks } = state;
  const { padX, trackH } = settings;
  const tw = trackW();

  for (let ti = 0; ti < tracks.length; ti++) {
    const track = tracks[ti];
    const mat = settings.materials[track.material];
    const ty = trackTop(ti);

    ctx.fillStyle = `#292929`;
    ctx.beginPath();
    ctx.roundRect(padX, ty, tw, trackH, 3);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(padX, ty, tw, trackH, 3);
    ctx.clip();

    for (const clip of track.clips) {
      const clipX = fromFrac(clip.left);
      const clipW = fromFrac(clip.right) - clipX;

      ctx.fillStyle = mat.fill;
      ctx.strokeStyle = mat.stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(clipX, ty, clipW, trackH);
      ctx.strokeRect(clipX, ty, clipW, trackH);

      const drawStroke = (stroke) => {
        if (stroke.length < 2) return;
        const clipPath = new Path2D();
        clipPath.rect(clipX, ty, clipW, trackH);
        ctx.save();
        ctx.clip(clipPath);
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.strokeStyle = `rgba(0, 0, 0, 1)`;
        ctx.lineWidth = 4;
        ctx.lineJoin = `round`;
        ctx.lineCap = `round`;
        ctx.stroke();
        ctx.restore();
      };

      for (const stroke of clip.marks) drawStroke(stroke);
      if (state.pressing) drawStroke(state.currentMark);
    }

    ctx.restore();
  }
}

function drawCursor() {
  const { pointerIn, pressing, blend, virtX, virtY, canvasW } = state;
  const { padX } = settings;
  if (!pointerIn) return;

  ctx.save();

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

  ctx.beginPath();
  ctx.arc(virtX, virtY, pressing ? 2.5 : 3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${pressing ? 0.95 : 0.52})`;
  ctx.fill();

  ctx.restore();
}

const debugEl = document.getElementById(`debug`);
function drawDebug() {
  if (!debugEl) return;
  const { blend, virtY } = state;
  const matKey = state.tracks[trackAtY(virtY)]?.material ?? null;
  const ph = getPhysics(blend, matKey);
  const f2 = (n) => n.toFixed(2);
  debugEl.textContent =
    `pull X/Y  ${f2(ph.pullX)} / ${f2(ph.pullY)}\n` +
    `friction  ${f2(ph.frictionX)} / ${f2(ph.frictionY)}\n` +
    `weight    ${f2(ph.weight)}\n` +
    `noise     ${f2(ph.noise)}`;
}

function draw() {
  ctx.clearRect(0, 0, state.canvasW, state.canvasH);
  drawTimeline();
  drawCursor();
  drawDebug();
}

function update() {
  const { pointerIn, realX, realY, virtX, virtY, velX, velY,
    pressing, noiseT, blend } = state;
  if (!pointerIn) return;

  const matKey = state.tracks[trackAtY(virtY)]?.material ?? null;
  const ph = getPhysics(blend, matKey);

  let newVelX = (velX + (realX - virtX) * ph.pullX / ph.weight) * (1 - ph.frictionX);
  let newVelY = (velY + (realY - virtY) * ph.pullY / ph.weight) * (1 - ph.frictionY);
  let newNoiseT = noiseT;

  if (ph.noise > 0) {
    const noise = applyNoise(newVelX, newVelY, noiseT, ph.noise);
    newVelX = noise.velX;
    newVelY = noise.velY;
    newNoiseT = noise.noiseT;
  }

  const newVirtX = virtX + newVelX;
  const newVirtY = virtY + newVelY;

  let newCurrentMark = state.currentMark;
  if (pressing) {
    const pt = { x: newVirtX, y: newVirtY };
    const last = newCurrentMark.at(-1);
    if (!last || Points.distance(pt, last) > 1.5) {
      newCurrentMark = [ ...newCurrentMark, pt ];
    }
  }

  saveState({ virtX: newVirtX, virtY: newVirtY, velX: newVelX, velY: newVelY,
    noiseT: newNoiseT, currentMark: newCurrentMark });
}

continuously(() => {
  update(); draw();
}).start();

const isValidPointer = (e) => e.pointerType === `mouse` || e.pointerType === `pen`;

function addPointerListener(type, handler) {
  // @ts-ignore
  canvas.addEventListener(type, (e) => {
    if (isValidPointer(e)) handler(e);
  });
}

addPointerListener(`pointermove`, (e) => saveState({ realX: e.offsetX, realY: e.offsetY, pointerIn: true }));

addPointerListener(`pointerenter`, (e) => saveState({
  realX: e.offsetX, realY: e.offsetY,
  virtX: e.offsetX, virtY: e.offsetY,
  velX: 0, velY: 0,
  pointerIn: true,
}));

addPointerListener(`pointerdown`, (e) => {
  e.preventDefault();
  saveState({
    realX: e.offsetX,
    realY: e.offsetY,
    pressing: true,
    currentMark: [ { x: state.virtX, y: state.virtY } ],
  });
});

addPointerListener(`pointerup`, (e) => {
  if (state.pressing) saveMarkToClips(state.currentMark);
  saveState({ pressing: false, currentMark: [] });
});

addPointerListener(`pointerleave`, () => {
  saveState({ pointerIn: false, pressing: false, currentMark: [] });
});

// @ts-ignore
canvas.addEventListener(`contextmenu`, (e) => e.preventDefault());

document.getElementById(`blend-slider`)?.addEventListener(`input`, (e) => {
  // @ts-ignore
  saveState({ blend: Number(e.target.value) / 100, velX: 0, velY: 0 });
});
