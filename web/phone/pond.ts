// The phone hero's koi pond: the TUI's PondSim on a small glyph grid, drawn into one canvas.
// Only cells that changed are redrawn; the loop runs at ~30fps and only while the hero is on
// screen. A tap splashes and the koi flee the finger; vertical drags still scroll the page.
// Under prefers-reduced-motion it draws one settled frame and stops.
import {
  PondSim,
  PAL_HEX,
  WATER_CP,
  WATER_CREST_HEX,
  WATER_TROUGH_HEX,
  CP_FULL,
  CP_HALF,
  CP_EYE,
  C_EYE,
  waterBucket,
  POND_BG_HEX,
  MOVE_AMP,
  DOWN_AMP,
} from "../../src/lib/pond";
import { tone } from "../dom/tone";

const CW = 9; // css px per cell, a phone-sized terminal cell
const CH = 16;
const FONT = `13px ui-monospace, SFMono-Regular, Menlo, Consolas, "Roboto Mono", monospace`;
const FRAME_MS = 33;

export function startHeroPond(canvas: HTMLCanvasElement, reduced: boolean): void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const bg = tone(POND_BG_HEX);
  const pal = PAL_HEX.map(tone);
  const crest = WATER_CREST_HEX.map(tone);
  const trough = WATER_TROUGH_HEX.map(tone);
  const water = WATER_CP.map((c) => String.fromCharCode(c));
  const full = String.fromCharCode(CP_FULL);
  const half = String.fromCharCode(CP_HALF);
  const eye = String.fromCharCode(CP_EYE);

  let cols = 0;
  let rows = 0;
  let sim = new PondSim(10, 6, 0.5); // replaced by size() with the real grid
  let shown: string[] = [];
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    cols = Math.max(10, Math.ceil(w / CW));
    rows = Math.max(6, Math.ceil(h / CH));
    sim = new PondSim(cols, rows, 0.5);
    shown = new Array(cols * rows).fill("");
  };

  const draw = () => {
    const { px, field, PW } = sim;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const top = px[2 * y * PW + x];
        const bot = px[(2 * y + 1) * PW + x];
        let ch = "";
        let col = "";
        if (top || bot) {
          const idx = top || bot;
          ch = idx === C_EYE ? eye : top && bot ? full : half;
          col = pal[idx];
        } else {
          const v = field[y * cols + x];
          const b = waterBucket(v < 0 ? -v : v);
          if (b) {
            ch = water[b];
            col = v > 0 ? crest[b] : trough[b];
          }
        }
        const key = ch + col;
        const i = y * cols + x;
        if (shown[i] === key) continue;
        shown[i] = key;
        ctx.fillStyle = bg;
        ctx.fillRect(x * CW, y * CH, CW, CH);
        if (ch) {
          ctx.fillStyle = col;
          ctx.fillText(ch, x * CW + CW / 2, y * CH + CH / 2);
        }
      }
    }
  };

  size();
  if (reduced) {
    // let the koi swim in, then hold one frame
    for (let i = 0; i < 240; i += 1) sim.step(FRAME_MS);
    draw();
    return;
  }

  const cell = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / CW), y: Math.floor((e.clientY - r.top) / CH) };
  };
  const hero = canvas.parentElement ?? canvas;
  hero.addEventListener("pointerdown", (e) => {
    const c = cell(e);
    sim.mouse = c;
    sim.splash(c.x, c.y, DOWN_AMP);
  });
  hero.addEventListener("pointermove", (e) => {
    const c = cell(e);
    sim.mouse = c;
    sim.splash(c.x, c.y, MOVE_AMP);
  });
  const clear = () => (sim.mouse = null);
  hero.addEventListener("pointerup", clear);
  hero.addEventListener("pointercancel", clear);
  hero.addEventListener("pointerleave", clear);

  let visible = true;
  let last = 0;
  let raf = 0;
  const frame = (t: number) => {
    raf = 0;
    if (!visible) return;
    if (t - last >= FRAME_MS) {
      sim.step(Math.min(100, last ? t - last : FRAME_MS));
      draw();
      last = t;
    }
    raf = requestAnimationFrame(frame);
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = 0;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(canvas);
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      size();
      draw();
    }, 150);
  }).observe(canvas);
}
