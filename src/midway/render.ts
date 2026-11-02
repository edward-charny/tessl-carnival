import { canvasFont, theme } from '../carnival';
import bannerUrl from './aidevcon-banner.png';
import { palette } from './palette';
import {
  CART_KINDS,
  toScreen,
  type BoothSlot,
  type MidwayMap,
  type Point,
  type Prop,
  type Rect,
  type Walker,
} from './world';

/**
 * Flat, isometric vector drawing for the midway, in world pixels. The caller
 * sets up the canvas transform for the camera and zoom.
 */

type Ctx = CanvasRenderingContext2D;
type Pt = readonly [number, number];

/** A tile position, `z` pixels above the ground, in world pixels. */
function at(x: number, y: number, z = 0): Pt {
  const s = toScreen(x, y);
  return [s.x, s.y - z];
}

/** Screen size of a one-tile radius circle lying on the ground. */
const ISO_RX = 16 * Math.SQRT2;
const ISO_RY = 8 * Math.SQRT2;

function poly(ctx: Ctx, points: readonly Pt[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stroke(ctx: Ctx, points: readonly Pt[], color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

/** A tile-aligned box, `z` pixels off the ground and `h` pixels tall. */
function box(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  d: number,
  z: number,
  h: number,
  top: string,
  left: string,
  right: string,
) {
  if (h > 0) {
    poly(
      ctx,
      [at(x, y + d, z), at(x + w, y + d, z), at(x + w, y + d, z + h), at(x, y + d, z + h)],
      left,
    );
    poly(
      ctx,
      [at(x + w, y + d, z), at(x + w, y, z), at(x + w, y, z + h), at(x + w, y + d, z + h)],
      right,
    );
  }
  poly(
    ctx,
    [at(x, y, z + h), at(x + w, y, z + h), at(x + w, y + d, z + h), at(x, y + d, z + h)],
    top,
  );
}

/**
 * A vertical wall from one ground point to another, in alternating colour
 * strips. With a `seed`, each strip is a plank whose top rises to an uneven point.
 */
function stripedWall(
  ctx: Ctx,
  a: Point,
  b: Point,
  z: number,
  h: number,
  strips: number,
  colors: readonly string[],
  seed?: number,
) {
  for (let i = 0; i < strips; i++) {
    const s0 = i / strips;
    const s1 = (i + 1) / strips;
    const x0 = lerp(a.x, b.x, s0);
    const y0 = lerp(a.y, b.y, s0);
    const x1 = lerp(a.x, b.x, s1);
    const y1 = lerp(a.y, b.y, s1);
    const points: Pt[] = [at(x0, y0, z), at(x1, y1, z), at(x1, y1, z + h)];
    if (seed !== undefined)
      points.push(at((x0 + x1) / 2, (y0 + y1) / 2, z + h + 2 + hash(i, seed) * 4));
    points.push(at(x0, y0, z + h));
    poly(ctx, points, colors[i % colors.length]);
  }
}

/** A ragged hem of triangle teeth hanging from an edge. */
function raggedHem(
  ctx: Ctx,
  a: Point,
  b: Point,
  z: number,
  count: number,
  depth: number,
  colors: readonly string[],
) {
  for (let i = 0; i < count; i++) {
    const p0 = at(lerp(a.x, b.x, i / count), lerp(a.y, b.y, i / count), z);
    const p1 = at(lerp(a.x, b.x, (i + 1) / count), lerp(a.y, b.y, (i + 1) / count), z);
    const drop = depth * (1.4 + hash(i, count) * 0.8);
    poly(
      ctx,
      [p0, p1, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + drop]],
      colors[i % colors.length],
    );
  }
}

/** A dark line round an outer silhouette, so it stands off the ground. */
function outline(ctx: Ctx, points: readonly Pt[], width = 1) {
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.stroke();
}

/** A swaying torch flame standing on (x, y), about 7 by 12 pixels at size 1. */
function flame(ctx: Ctx, x: number, y: number, t: number, size = 1) {
  const sway = Math.sin(t * 9 + x) * 1.2 * size;
  const tongue = (color: string, width: number, height: number, base: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + sway, base - height);
    ctx.quadraticCurveTo(x + width, base - height * 0.3, x, base);
    ctx.quadraticCurveTo(x - width, base - height * 0.3, x + sway, base - height);
    ctx.fill();
  };
  tongue(palette.fire, 7 * size, 12 * size, y);
  tongue(palette.fireCore, 4 * size, 7 * size, y + 1);
}

/** Torchlight on the ground. Static, so only the ground layer draws it. */
function lightPool(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  oval(ctx, x, y, rx, ry, palette.torchGlow);
  oval(ctx, x, y, rx * 0.55, ry * 0.55, palette.torchGlowCore);
}

/**
 * Adds one sharpened stake's shaft to the current path, standing on a tile
 * position and leaning by `lean` tiles at the top. Returns its 2 px tip, for
 * the caller to stroke with the other tips.
 */
function stake(ctx: Ctx, x: number, y: number, z: number, h: number, lean: Point): [Pt, Pt] {
  const base = at(x, y, z);
  const tip = at(x + lean.x, y + lean.y, z + h);
  const s = (h - 2) / h;
  const neck: Pt = [lerp(base[0], tip[0], s), lerp(base[1], tip[1], s)];
  ctx.moveTo(base[0], base[1]);
  ctx.lineTo(neck[0], neck[1]);
  return [neck, tip];
}

/** Rag pennants with a notched hem, hanging along a line of screen points. */
function flags(ctx: Ctx, points: readonly Pt[], t: number, size = 5, phase = 0) {
  let n = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const flutter = Math.sin(t * 4 + i * 0.9 + phase) * 1.2;
    const drop = size * 1.6;
    poly(
      ctx,
      [
        [x0, y0],
        [x1, y1],
        [x1 + flutter, y1 + drop],
        [(x0 + x1) / 2 + flutter, (y0 + y1) / 2 + drop - size * 0.5],
        [x0 + flutter, y0 + drop],
      ],
      palette.bunting[n++ % palette.bunting.length],
    );
  }
}

function flag(ctx: Ctx, x: number, y: number, t: number, color: string, size = 1) {
  stroke(
    ctx,
    [
      [x, y],
      [x, y - 14 * size],
    ],
    palette.woodDark,
    1.2,
  );
  const wave = Math.sin(t * 5 + x * 0.1) * 1.5 * size;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 14 * size);
  ctx.quadraticCurveTo(x + 6 * size, y - 16 * size + wave, x + 12 * size, y - 14 * size);
  ctx.lineTo(x + 9 * size, y - 11 * size + wave * 0.5);
  ctx.lineTo(x + 12 * size, y - 8 * size);
  ctx.quadraticCurveTo(x + 6 * size, y - 10 * size + wave, x, y - 8 * size);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws on a vertical plane facing down-left (parallel to the x axis), so
 * signs and wheels sit in the scene. Local x runs along the plane, local y down.
 */
function onPlane(ctx: Ctx, origin: Pt, paint: () => void) {
  ctx.save();
  ctx.transform(0.894, 0.447, 0, 1, origin[0], origin[1]);
  paint();
  ctx.restore();
}

/** A board outline with its corners cut off at 2 px, as a new path. */
function notched(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const c = 2;
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/** A wooden sign with text, in plane-local coordinates centred on (0, 0). */
function signBoard(
  ctx: Ctx,
  text: string,
  width: number,
  height: number,
  colors: { board: string; edge: string; text: string },
  glow = false,
) {
  ctx.fillStyle = colors.edge;
  notched(ctx, -width / 2 - 2, -height / 2 - 2, width + 4, height + 4);
  ctx.fill();
  ctx.fillStyle = colors.board;
  notched(ctx, -width / 2, -height / 2, width, height);
  ctx.fill();
  if (glow) {
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (const side of [-1, 1])
    oval(ctx, side * (width / 2 - 4), -height / 2 + 2.5, 0.9, 0.9, palette.woodDark);
  ctx.font = canvasFont('small', 'bold');
  const fit = Math.min(
    (height * 0.62) / theme.font.small,
    (width - 8) / ctx.measureText(text).width,
  );
  ctx.save();
  ctx.scale(fit, fit);
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

// ── Ground ────────────────────────────────────────────────────────────────

/** The world-pixel height of the horizon; the field runs off to it. */
export const HORIZON = -24;

function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rectPoints(r: Rect, lift = 0): Pt[] {
  return [
    at(r.x, r.y, lift),
    at(r.x + r.w, r.y, lift),
    at(r.x + r.w, r.y + r.h, lift),
    at(r.x, r.y + r.h, lift),
  ];
}

/** The world-pixel box the pre-drawn ground layer covers. */
export function groundBounds(map: MidwayMap): Box {
  return {
    left: -map.height * 16 - 64,
    right: map.width * 16 + 64,
    top: -64,
    bottom: (map.width + map.height) * 8 + 4,
  };
}

/** The open field round the midway, filling the view from the horizon down. */
export function drawField(ctx: Ctx, view: Box) {
  ctx.fillStyle = palette.haze;
  ctx.fillRect(view.left, HORIZON, view.right - view.left, 6);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(view.left, HORIZON + 6, view.right - view.left, Math.max(0, view.bottom - HORIZON));
}

/**
 * The most pixels the ground layer may use. Safari refuses canvases over
 * 16,777,216 pixels, and a long midway on a sharp screen would pass that.
 */
const MAX_GROUND_PIXELS = 16_000_000;

export interface GroundLayer {
  canvas: HTMLCanvasElement;
  /** Device pixels per world pixel the layer was drawn at. */
  scale: number;
}

/**
 * Draws the parts of the ground that never change (the grass, paths, trees
 * and the hedge's back two sides) once, onto an off-screen canvas covering
 * groundBounds(map). It uses `scale` device pixels per world pixel, or less
 * when that would make the canvas too big, so its size stays bounded however
 * long the midway grows.
 */
export function drawGroundLayer(map: MidwayMap, wanted: number): GroundLayer {
  const bounds = groundBounds(map);
  const area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
  const scale = Math.min(wanted, Math.sqrt(MAX_GROUND_PIXELS / area));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((bounds.right - bounds.left) * scale);
  canvas.height = Math.ceil((bounds.bottom - bounds.top) * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);

  // Lighter plots of grass inside the hedge, raised a little above the paths.
  poly(ctx, rectPoints({ x: 0, y: 0, w: map.width, h: map.height }), palette.grassLight);
  for (const path of map.paths) poly(ctx, rectPoints(path, 3), palette.grassEdge);
  for (const path of map.paths) poly(ctx, rectPoints(path), palette.path);

  // Tufts of grass, with the odd bit of scrap, and ruts worn into the paths.
  ctx.strokeStyle = palette.grassDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.ground[y * map.width + x] !== 'grass' || hash(x, y) > 0.5) continue;
      const [px, py] = at(x + hash(x, y, 1), y + hash(x, y, 2));
      ctx.moveTo(px - 2, py - 2);
      ctx.lineTo(px, py);
      ctx.lineTo(px + 2, py - 3);
    }
  }
  ctx.stroke();
  ctx.fillStyle = palette.scrap;
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.ground[y * map.width + x] !== 'grass' || hash(x, y, 3) > 1 / 12) continue;
      const [px, py] = at(x + hash(x, y, 4), y + hash(x, y, 5));
      ctx.fillRect(px, py, 2, 1);
    }
  }
  ctx.strokeStyle = palette.pathShade;
  ctx.beginPath();
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.ground[y * map.width + x] !== 'path' || hash(x, y, 6) > 1 / 6) continue;
      const [px, py] = at(x + 0.2 + hash(x, y, 7) * 0.4, y + 0.3);
      ctx.moveTo(px, py);
      ctx.lineTo(px + 6, py + 3);
    }
  }
  ctx.stroke();

  // Torchlight: under every open booth, bunting pole, the big top's door and the gate.
  for (const slot of map.booths.filter((b) => b.gameId)) {
    const [px, py] = at(slot.x + 0.15 + 1.7, slot.y + 0.15 + 1.7);
    lightPool(ctx, px, py, 46, 22);
  }
  for (const prop of map.props) {
    if (prop.kind === 'bunting-pole') {
      const [px, py] = at(prop.x + 0.5, prop.y + 0.5);
      lightPool(ctx, px, py, 22, 10);
    } else if (prop.kind === 'big-top') {
      const [px, py] = at(prop.x + prop.w / 2, prop.y + prop.h / 2);
      lightPool(ctx, px, py + BIG_TOP_RADIUS * ISO_RY + 4, 34, 14);
    }
  }
  const [gx, gy] = at(map.avenueX + (ARCH_LEFT + ARCH_RIGHT + 0.36) / 2, map.height - 0.75);
  lightPool(ctx, gx, gy, 40, 16);

  // Dead trees out in the field behind the midway.
  for (let i = 0; i < map.width; i += 2) tree(ctx, i + 0.5 + hash(i, 1) * 0.6, -1.4 - hash(i, 2));
  for (let i = 2; i < map.height; i += 2) tree(ctx, -1.4 - hash(1, i), i + 0.5 + hash(2, i) * 0.6);

  hedge(ctx, { x: 0, y: 0, w: map.width, h: 1 });
  hedge(ctx, { x: 0, y: 0, w: 1, h: map.height });
  return { canvas, scale };
}

function tree(ctx: Ctx, x: number, y: number) {
  const [px, py] = at(x, y);
  const seed = Math.round(px + py * 7);
  oval(ctx, px + 4, py + 1, 10, 4, palette.shadow);
  poly(
    ctx,
    [
      [px - 2, py],
      [px + 2, py],
      [px + 1, py - 20],
      [px - 1, py - 20],
    ],
    palette.woodDark,
  );
  ctx.strokeStyle = palette.woodDark;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const by = py - 10 - i * 4;
    const side = i % 2 ? 1 : -1;
    const angle = -Math.PI / 2 + side * (0.5 + hash(seed, i) * 0.7);
    const len = 7 + hash(seed, i, 1) * 5;
    ctx.moveTo(px, by);
    ctx.lineTo(px + Math.cos(angle) * len, by + Math.sin(angle) * len);
  }
  ctx.stroke();
  oval(ctx, px - 2, py - 11, 2.5, 1.5, palette.hedgeDark);
  oval(ctx, px + 1.5, py - 17, 2, 1.3, palette.hedgeDark);
}

/** A spiked bramble barricade: a low mound with stakes leaning outward. */
function hedge(ctx: Ctx, area: Rect) {
  const x0 = area.x + 0.15;
  const y0 = area.y + 0.15;
  const w = area.w - 0.3;
  const d = area.h - 0.3;
  box(ctx, x0, y0, w, d, 0, 6, palette.hedgeLight, palette.hedge, palette.hedgeDark);
  // Run along the long side; a one-tile-deep run's outward edge faces away from the midway.
  const alongX = area.w >= area.h;
  const length = alongX ? w : d;
  const outward: Point = alongX
    ? { x: 0, y: area.y === 0 ? -0.15 : 0.15 }
    : { x: area.x === 0 ? -0.15 : 0.15, y: 0 };
  const edge = (s: number): Point =>
    alongX
      ? { x: x0 + s, y: outward.y < 0 ? y0 : y0 + d }
      : { x: outward.x < 0 ? x0 : x0 + w, y: y0 + s };
  const front = (s: number): Point =>
    alongX ? { x: x0 + s, y: y0 + d } : { x: x0 + w, y: y0 + s };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.hedgeDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0, s = 0; s <= length; i++, s += 0.25) {
    const p = front(s);
    const [px, py] = at(p.x, p.y, 6 + (i % 2 ? 4 : 1));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  const tips: [Pt, Pt][] = [];
  ctx.strokeStyle = palette.wood;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let s = 0.25; s < length; s += 0.5) {
    const p = edge(s);
    tips.push(stake(ctx, p.x, p.y, 0, 16, outward));
  }
  ctx.stroke();
  ctx.strokeStyle = palette.cream;
  ctx.beginPath();
  for (const [neck, tip] of tips) {
    ctx.moveTo(neck[0], neck[1]);
    ctx.lineTo(tip[0], tip[1]);
  }
  ctx.stroke();
}

/** The hedge's front two sides, which can stand in front of anything. */
export function drawFrontHedge(ctx: Ctx, map: MidwayMap) {
  const h = map.height - 1;
  hedge(ctx, { x: map.width - 1, y: 1, w: 1, h: map.height - 1 });
  hedge(ctx, { x: 1, y: h, w: map.avenueX - 1, h: 1 });
  hedge(ctx, { x: map.avenueX + 2, y: h, w: map.width - map.avenueX - 3, h: 1 });
}

// ── Round things: yurts, the big top, the carousel ────────────────────────

interface Stripes {
  a: string;
  aShade: string;
  b: string;
  bShade: string;
}

const HIDE: Stripes = {
  a: palette.hide,
  aShade: palette.hideShade,
  b: palette.hideDark,
  bShade: palette.woodDark,
};
const RED: Stripes = {
  a: palette.red,
  aShade: palette.redShade,
  b: palette.hide,
  bShade: palette.hideShade,
};
const BLUE: Stripes = {
  a: palette.blue,
  aShade: palette.blueShade,
  b: palette.hide,
  bShade: palette.hideShade,
};
const TENT_COLORS = [HIDE, RED, BLUE, HIDE] as const;

function rimPoint(c: Pt, r: number, angle: number, z: number): Pt {
  return [c[0] + Math.cos(angle) * r * ISO_RX, c[1] + Math.sin(angle) * r * ISO_RY - z];
}

/** The front half of a striped cylinder, its strips sharpened into palisade stakes. */
function cylinder(ctx: Ctx, c: Pt, r: number, z: number, h: number, colors: Stripes, count = 16) {
  for (let k = 0; k < count; k++) {
    const a0 = Math.max(0, (k / count) * Math.PI * 2);
    const a1 = Math.min(Math.PI, ((k + 1) / count) * Math.PI * 2);
    if (a1 <= a0) continue;
    const points: Pt[] = [];
    for (let i = 0; i <= 4; i++) points.push(rimPoint(c, r, lerp(a0, a1, i / 4), z));
    points.push(rimPoint(c, r, a1, z + h));
    points.push(rimPoint(c, r, (a0 + a1) / 2, z + h + 4));
    points.push(rimPoint(c, r, a0, z + h));
    const shade = (a0 + a1) / 2 < Math.PI * 0.35;
    poly(
      ctx,
      points,
      k % 2 === 0 ? (shade ? colors.aShade : colors.a) : shade ? colors.bShade : colors.b,
    );
  }
}

/** A hide roof of stitched wedges, with patches. `turn` spins the wedges. */
function dome(
  ctx: Ctx,
  c: Pt,
  r: number,
  z: number,
  h: number,
  colors: Stripes,
  turn = 0,
  count = 16,
) {
  const apex: Pt = [c[0], c[1] - z - h];
  const wedges = Array.from({ length: count }, (_, k) => {
    const a0 = turn + (k / count) * Math.PI * 2;
    const a1 = turn + ((k + 1) / count) * Math.PI * 2;
    return { k, a0, a1, mid: (a0 + a1) / 2 };
  }).sort((p, q) => Math.sin(p.mid) - Math.sin(q.mid));
  for (const { k, a0, a1, mid } of wedges) {
    const control = (angle: number) => rimPoint(c, r * 0.92, angle, z + h * 0.6);
    const start = rimPoint(c, r, a0, z);
    const end = rimPoint(c, r, a1, z);
    const c0 = control(a0);
    const c1 = control(a1);
    ctx.beginPath();
    ctx.moveTo(apex[0], apex[1]);
    ctx.quadraticCurveTo(c0[0], c0[1], start[0], start[1]);
    for (let i = 1; i <= 3; i++) {
      const p = rimPoint(c, r, lerp(a0, a1, i / 3), z);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.lineTo(end[0], end[1]);
    ctx.quadraticCurveTo(c1[0], c1[1], apex[0], apex[1]);
    const shade = Math.cos(mid) > 0.45;
    const patch = hash(k, count, 9) < 0.2;
    ctx.fillStyle = patch
      ? palette.hideDark
      : k % 2 === 0
        ? shade
          ? colors.aShade
          : colors.a
        : shade
          ? colors.bShade
          : colors.b;
    ctx.fill();
  }
  // Stitches from the apex down the front.
  ctx.strokeStyle = palette.hideDark;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const angle of [Math.PI * 0.3, Math.PI * 0.5, Math.PI * 0.7]) {
    const control = rimPoint(c, r * 0.92, angle, z + h * 0.6);
    const rim = rimPoint(c, r, angle, z);
    ctx.moveTo(apex[0], apex[1]);
    ctx.quadraticCurveTo(control[0], control[1], rim[0], rim[1]);
  }
  ctx.stroke();
}

/** A ragged hem of triangle teeth round the front of a circle. */
function scallopRing(
  ctx: Ctx,
  c: Pt,
  r: number,
  z: number,
  count: number,
  depth: number,
  colors: readonly string[],
) {
  for (let k = 0; k < count; k++) {
    const a0 = (k / count) * Math.PI;
    const a1 = ((k + 1) / count) * Math.PI;
    const p0 = rimPoint(c, r, a0, z);
    const p1 = rimPoint(c, r, a1, z);
    const m = rimPoint(c, r * 1.02, (a0 + a1) / 2, z - depth * (1.4 + hash(k, count) * 0.8));
    poly(ctx, [p0, p1, m], colors[k % colors.length]);
  }
}

function ringFlags(ctx: Ctx, c: Pt, r: number, z: number, t: number, count = 14) {
  const points: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const angle = 0.08 + (i / count) * (Math.PI - 0.16);
    points.push(rimPoint(c, r, angle, z));
  }
  flags(ctx, points, t, 3.5);
}

/** Tent poles poking out of the apex. */
function tentPoles(ctx: Ctx, x: number, y: number) {
  ctx.strokeStyle = palette.woodDark;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const degrees of [-20, 0, 20]) {
    const a = (degrees * Math.PI) / 180;
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + Math.sin(a) * 10, y + 4 - Math.cos(a) * 10);
  }
  ctx.stroke();
}

/** A trophy rack: a crossbar with two horns curling outward. */
function knob(ctx: Ctx, x: number, y: number) {
  stroke(
    ctx,
    [
      [x - 5, y],
      [x + 5, y],
    ],
    palette.woodDark,
    1.6,
  );
  horns(ctx, x, y, 5, 1.4);
}

/** Two bone horns curling outward from (x ± 1, y). */
function horns(ctx: Ctx, x: number, y: number, size: number, width: number) {
  ctx.strokeStyle = palette.cream;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const bx = x + side * (size * 0.4);
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + side * size, y - size * 0.2, bx + side * size, y - size);
  }
  ctx.stroke();
}

/** A small hanging lantern with a flickering flame. */
function lantern(ctx: Ctx, x: number, y: number, t: number, i: number) {
  ctx.fillStyle = palette.metalShade;
  ctx.beginPath();
  ctx.roundRect(x - 2.5, y - 2.5, 5, 5, 1);
  ctx.fill();
  oval(ctx, x, y, 1.5, 1.5, Math.sin(t * 7 + i) > 0 ? palette.fire : palette.fireCore);
}

function roundTent(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  wall: number,
  roof: number,
  colors: Stripes,
  t: number,
  flagColor: string = palette.gold,
) {
  const c = at(cx, cy);
  oval(ctx, c[0] + 8, c[1] + 4, r * ISO_RX * 1.15, r * ISO_RY * 1.15, palette.shadow);
  cylinder(ctx, c, r, 0, wall, colors);
  // The door, with its hide curtains tied back.
  const door: Pt[] = [];
  for (let i = 0; i <= 6; i++)
    door.push(rimPoint(c, r, lerp(Math.PI / 2 - 0.24, Math.PI / 2 + 0.24, i / 6), 0));
  const top = rimPoint(c, r, Math.PI / 2, wall * 0.85);
  poly(
    ctx,
    [...door, [door[6][0], top[1] + 6], [top[0], top[1]], [door[0][0], top[1] + 6]],
    palette.opening,
  );
  stroke(ctx, [door[0], [door[0][0] + 2, top[1] + 8], [top[0], top[1]]], palette.rope, 2);
  stroke(ctx, [door[6], [door[6][0] - 2, top[1] + 8], [top[0], top[1]]], palette.rope, 2);

  scallopRing(ctx, c, r * 1.02, wall, 10, 3, [colors.a, colors.b]);
  dome(ctx, c, r * 1.12, wall, roof, colors);
  scallopRing(ctx, c, r * 1.12, wall, 12, 4, [colors.a, colors.b]);
  ringFlags(ctx, c, r * 1.05, wall + 2, t);
  const apex = c[1] - wall - roof;
  tentPoles(ctx, c[0], apex);
  knob(ctx, c[0], apex - 4);
  flag(ctx, c[0], apex - 6, t, flagColor);
}

const BIG_TOP_RADIUS = 1.9;

function bigTop(ctx: Ctx, prop: Prop, t: number) {
  const cx = prop.x + prop.w / 2;
  const cy = prop.y + prop.h / 2;
  roundTent(ctx, cx, cy, BIG_TOP_RADIUS, 38, 46, RED, t, palette.red);
  const c = at(cx, cy);
  // A second ring of pennants, and lanterns hung round the wall.
  ringFlags(ctx, c, 1.5, 38 + 22, t, 12);
  for (let i = 0; i < 5; i++) {
    const angle = 0.35 + (i / 4) * (Math.PI - 0.7);
    const p = rimPoint(c, BIG_TOP_RADIUS + 0.04, angle, 14);
    lantern(ctx, p[0], p[1], t, i);
  }
}

/** A boar on the beast-go-round, facing left or right. */
function boar(ctx: Ctx, x: number, y: number, facing: number, color: string) {
  stroke(
    ctx,
    [
      [x - 4, y + 2],
      [x - 5, y + 7],
    ],
    color,
    1.4,
  );
  stroke(
    ctx,
    [
      [x + 4, y + 2],
      [x + 5, y + 7],
    ],
    color,
    1.4,
  );
  oval(ctx, x, y, 6.5, 3.6, color);
  poly(
    ctx,
    [
      [x + facing * 5, y - 2.5],
      [x + facing * 10, y + 0.5],
      [x + facing * 5, y + 2],
    ],
    color,
  );
  ctx.strokeStyle = palette.cream;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const dy of [0.5, 1.8]) {
    ctx.moveTo(x + facing * 7.5, y + dy);
    ctx.lineTo(x + facing * 8.5, y + dy - 2);
  }
  ctx.stroke();
  poly(
    ctx,
    [
      [x - 2, y - 3.5],
      [x + 2, y - 3.5],
      [x + 1, y - 1.5],
      [x - 1, y - 1.5],
    ],
    palette.red,
  );
}

function carousel(ctx: Ctx, prop: Prop, t: number) {
  const cx = prop.x + prop.w / 2;
  const cy = prop.y + prop.h / 2;
  const c = at(cx, cy);
  const turn = t * 0.5;
  const r = 1.75;
  oval(ctx, c[0] + 8, c[1] + 4, r * ISO_RX * 1.1, r * ISO_RY * 1.1, palette.shadow);
  cylinder(ctx, c, r, 0, 6, HIDE, 24);
  oval(ctx, c[0], c[1] - 6, r * ISO_RX, r * ISO_RY, palette.scrap);
  oval(ctx, c[0], c[1] - 6, r * ISO_RX * 0.82, r * ISO_RY * 0.82, palette.metalShade);

  const roofZ = 46;
  const boars = Array.from({ length: 8 }, (_, i) => {
    const angle = turn + (i / 8) * Math.PI * 2;
    return { i, angle, base: rimPoint(c, r * 0.72, angle, 6) };
  });
  const drawBoar = ({ i, angle, base }: (typeof boars)[number]) => {
    const bob = Math.sin(t * 3 + i * 1.4) * 3;
    const [x, y] = base;
    stroke(
      ctx,
      [
        [x, y],
        [x, y - (roofZ - 6) + (Math.sin(angle) * r * ISO_RY) / 4],
      ],
      palette.woodDark,
      1.4,
    );
    const facing = Math.cos(angle + Math.PI / 2) < 0 ? -1 : 1;
    boar(ctx, x, y - 16 + bob, facing, i % 2 ? palette.hide : palette.woodLight);
  };
  boars.filter((h) => Math.sin(h.angle) < 0).forEach(drawBoar);
  // The totem in the middle, three carved segments with red bands.
  const column = rimPoint(c, 0, 0, 6);
  const height = column[1] - (c[1] - roofZ);
  [palette.wood, palette.woodLight, palette.wood].forEach((color, i) => {
    const bottom = column[1] - (height * i) / 3;
    const top = column[1] - (height * (i + 1)) / 3;
    poly(
      ctx,
      [
        [column[0] - 5, bottom],
        [column[0] + 5, bottom],
        [column[0] + 5, top],
        [column[0] - 5, top],
      ],
      color,
    );
    poly(
      ctx,
      [
        [column[0] - 5, top + 3],
        [column[0] + 5, top + 3],
        [column[0] + 5, top + 5],
        [column[0] - 5, top + 5],
      ],
      palette.red,
    );
  });
  boars.filter((h) => Math.sin(h.angle) >= 0).forEach(drawBoar);

  dome(ctx, c, r * 1.15, roofZ, 26, HIDE, turn);
  scallopRing(ctx, c, r * 1.15, roofZ, 14, 4, [palette.hide, palette.hideDark]);
  ringFlags(ctx, c, r * 1.05, roofZ - 6, t, 16);
  knob(ctx, c[0], c[1] - roofZ - 26);
  flag(ctx, c[0], c[1] - roofZ - 28, t, palette.gold);
}

// ── Square things ─────────────────────────────────────────────────────────

/** Two crossed timbers above a ridge end. */
function ridgeCross(ctx: Ctx, ridge: Pt) {
  const [x, y] = ridge;
  ctx.strokeStyle = palette.woodDark;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 2);
  ctx.lineTo(x + 4, y - 8 - 2);
  ctx.moveTo(x + 4, y + 2);
  ctx.lineTo(x - 4, y - 8 - 2);
  ctx.stroke();
}

/** A plank longhouse with a hide roof running along the x axis. */
function peakedTent(ctx: Ctx, prop: Prop, t: number) {
  const x0 = prop.x + 0.2;
  const x1 = prop.x + prop.w - 0.2;
  const y0 = prop.y + 0.25;
  const y1 = prop.y + prop.h - 0.25;
  const ym = (y0 + y1) / 2;
  const wall = 24;
  const roof = 26;
  const eave = 0.18;
  const seed = prop.x + prop.y * 31;

  poly(ctx, rectPoints({ x: x0 + 0.3, y: y0 + 0.3, w: x1 - x0, h: y1 - y0 }), palette.shadow);
  // The back of the roof, mostly hidden behind the front.
  poly(
    ctx,
    [
      at(x0 - 0.1, y0 - eave, wall - 3),
      at(x1 + 0.1, y0 - eave, wall - 3),
      at(x1 + 0.1, ym, wall + roof),
      at(x0 - 0.1, ym, wall + roof),
    ],
    palette.hideShade,
  );

  // The gable end, upright planks with uneven points up to the roof line.
  const strips = 10;
  const half = (y1 - y0) / 2;
  const height = (y: number) => wall + roof * (1 - Math.abs(y - ym) / half);
  for (let i = 0; i < strips; i++) {
    const ya = lerp(y1, y0, i / strips);
    const yb = lerp(y1, y0, (i + 1) / strips);
    const yc = (ya + yb) / 2;
    const points: Pt[] = [at(x1, ya, 0), at(x1, yb, 0), at(x1, yb, height(yb))];
    points.push(at(x1, yc, height(yc) + 2 + hash(i, seed) * 3));
    points.push(at(x1, ya, height(ya)));
    poly(ctx, points, i % 2 === 0 ? palette.wood : palette.woodLight);
  }
  stripedWall(
    ctx,
    { x: x0, y: y1 },
    { x: x1, y: y1 },
    0,
    wall,
    14,
    [palette.woodLight, palette.wood, palette.scrap],
    seed,
  );
  // The entrance, on the gable end, with a hide flap hanging on one side.
  const door = [
    at(x1, ym + 0.35, 0),
    at(x1, ym - 0.35, 0),
    at(x1, ym - 0.2, wall * 0.8),
    at(x1, ym, wall * 0.95),
    at(x1, ym + 0.2, wall * 0.8),
  ];
  poly(ctx, door, palette.opening);
  poly(
    ctx,
    [
      at(x1, ym - 0.2, wall * 0.8),
      at(x1, ym, wall * 0.95),
      at(x1, ym, wall * 0.45),
      at(x1, ym - 0.3, wall * 0.4),
    ],
    palette.hideDark,
  );
  stroke(ctx, [door[0], door[4], door[3]], palette.rope, 1.6);
  stroke(ctx, [door[1], door[2], door[3]], palette.rope, 1.6);

  // The front of the roof, in hide strips.
  const roofStrips = 12;
  for (let i = 0; i < roofStrips; i++) {
    const xa = lerp(x0 - 0.1, x1 + 0.1, i / roofStrips);
    const xb = lerp(x0 - 0.1, x1 + 0.1, (i + 1) / roofStrips);
    poly(
      ctx,
      [
        at(xa, y1 + eave, wall - 3),
        at(xb, y1 + eave, wall - 3),
        at(xb, ym, wall + roof),
        at(xa, ym, wall + roof),
      ],
      i % 2 === 0 ? palette.hide : palette.hideShade,
    );
  }
  poly(
    ctx,
    [
      at(x1 + 0.1, y1 + eave, wall - 3),
      at(x1 + 0.1, ym, wall + roof),
      at(x1 + 0.1, ym, wall + roof - 2),
      at(x1 + 0.1, y1 + eave, wall - 5),
    ],
    palette.hideDark,
  );
  raggedHem(ctx, { x: x0 - 0.1, y: y1 + eave }, { x: x1 + 0.1, y: y1 + eave }, wall - 3, 12, 3, [
    palette.hide,
    palette.hideDark,
  ]);
  const eaveLine: Pt[] = [];
  for (let i = 0; i <= 16; i++) eaveLine.push(at(lerp(x0, x1, i / 16), y1 + eave, wall - 7));
  flags(ctx, eaveLine, t, 3.5, prop.x);
  const ridgeFront = at(x1 + 0.1, ym, wall + roof);
  const ridgeBack = at(x0 - 0.1, ym, wall + roof);
  ridgeCross(ctx, ridgeBack);
  ridgeCross(ctx, ridgeFront);
  flag(ctx, ridgeBack[0], ridgeBack[1], t, palette.gold);
  flag(ctx, ridgeFront[0], ridgeFront[1], t + 1, palette.red);
}

function wheel(ctx: Ctx, x: number, y: number, r: number) {
  oval(ctx, x, y, r, r, palette.metalShade);
  oval(ctx, x, y, r * 0.8, r * 0.8, palette.wood);
  ctx.strokeStyle = palette.woodDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    ctx.moveTo(x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8);
    ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
  }
  ctx.stroke();
  oval(ctx, x, y, r * 0.25, r * 0.25, palette.metal);
}

/** A scrap war-wagon: a plank cage with spikes along the top. */
function wagon(ctx: Ctx, prop: Prop) {
  const x = prop.x + 0.1;
  const y = prop.y + 0.1;
  const w = prop.w - 0.2;
  const d = prop.h - 0.25;
  poly(ctx, rectPoints({ x: x + 0.3, y: y + 0.3, w, h: d }), palette.shadow);
  box(ctx, x, y, w, d, 7, 24, palette.woodLight, palette.wood, palette.woodDark);
  // Cage bars along the side.
  ctx.strokeStyle = palette.metal;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 1; i < 14; i++) {
    const bx = lerp(x + 0.3, x + w - 0.3, i / 14);
    const [ax, ay] = at(bx, y + d, 11);
    const [tx, ty] = at(bx, y + d, 27);
    ctx.moveTo(ax, ay);
    ctx.lineTo(tx, ty);
  }
  ctx.stroke();
  poly(
    ctx,
    [
      at(x + 0.25, y + d, 11),
      at(x + w - 0.25, y + d, 11),
      at(x + w - 0.25, y + d, 12.5),
      at(x + 0.25, y + d, 12.5),
    ],
    palette.metalShade,
  );
  box(
    ctx,
    x - 0.05,
    y - 0.05,
    w + 0.1,
    d + 0.1,
    31,
    3,
    palette.scrap,
    palette.metalShade,
    palette.metalShade,
  );
  for (let i = 0; i < 5; i++) {
    const [sx, sy] = at(lerp(x + 0.2, x + w - 0.2, i / 4), y + d + 0.05, 34);
    poly(
      ctx,
      [
        [sx - 1, sy],
        [sx + 1, sy],
        [sx, sy - 5],
      ],
      palette.metal,
    );
  }
  // A round shield on the side, and the wheels.
  const crest = at(x + w / 2, y + d, 22);
  oval(ctx, crest[0], crest[1], 6, 6, palette.red);
  poly(
    ctx,
    [
      [crest[0] - 5, crest[1] - 0.75],
      [crest[0] + 5, crest[1] - 0.75],
      [crest[0] + 5, crest[1] + 0.75],
      [crest[0] - 5, crest[1] + 0.75],
    ],
    palette.cream,
  );
  for (const wx of [x + 0.45, x + w - 0.45]) {
    const p = at(wx, y + d + 0.02, 6);
    wheel(ctx, p[0], p[1], 6);
  }
}

/** A horned helmet on a head at (x, y). */
function helmet(ctx: Ctx, x: number, y: number, color: string) {
  horns(ctx, x, y - 1, 3, 1.2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 4.6, 3.6, 0, Math.PI, Math.PI * 2);
  ctx.fill();
}

/** A goblin, standing on (x, y). */
function person(
  ctx: Ctx,
  x: number,
  y: number,
  look: Look,
  options: { swing?: number; back?: boolean; dir?: number; player?: boolean; t?: number } = {},
) {
  const swing = options.swing ?? 0;
  const dir = options.dir ?? 1;
  oval(ctx, x, y, 5, 2, palette.shadow);
  if (options.player) {
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  stroke(
    ctx,
    [
      [x - 1.6, y - 7],
      [x - 2.2 + swing * 1.6, y - 1],
    ],
    look.pants,
    2.6,
  );
  stroke(
    ctx,
    [
      [x + 1.6, y - 7],
      [x + 2.2 - swing * 1.6, y - 1],
    ],
    look.pants,
    2.6,
  );
  // A hunched tunic with a ragged hem.
  const lean = dir * 0.6;
  poly(
    ctx,
    [
      [x - 3.5 + lean, y - 16],
      [x + 3.5 + lean, y - 16],
      [x + 4.5, y - 8],
      [x + 4.5, y - 7],
      [x + 1.5, y - 8],
      [x + 1.5, y - 6.2],
      [x - 1.5, y - 8],
      [x - 1.5, y - 6.2],
      [x - 4.5, y - 8],
    ],
    look.shirt,
  );
  stroke(
    ctx,
    [
      [x - 3.5 + lean, y - 15],
      [x - 5 - swing, y - 7],
    ],
    look.skin,
    2,
  );
  stroke(
    ctx,
    [
      [x + 3.5 + lean, y - 15],
      [x + 5 + swing, y - 7],
    ],
    look.skin,
    2,
  );
  // Ears first, then the head, outlined together so skin stands off the path.
  const ears: Pt[][] = [
    [
      [x - 3.4, y - 21.5],
      [x - 9.5, y - 24.5],
      [x - 3.6, y - 19.2],
    ],
    [
      [x + 3.4, y - 21.5],
      [x + 9.5, y - 24.5],
      [x + 3.6, y - 19.2],
    ],
  ];
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = 0.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const ear of ears) {
    ctx.moveTo(ear[0][0], ear[0][1]);
    ctx.lineTo(ear[1][0], ear[1][1]);
    ctx.lineTo(ear[2][0], ear[2][1]);
    ctx.closePath();
  }
  ctx.moveTo(x + 4.6, y - 20);
  ctx.ellipse(x, y - 20, 4.6, 3.9, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const ear of ears) poly(ctx, ear, look.skin);
  oval(ctx, x, y - 20, 4.6, 3.9, look.skin);
  poly(
    ctx,
    [
      [x - 2, y - 23.6],
      [x, y - 27.5],
      [x + 2, y - 23.6],
    ],
    look.hair,
  );
  if (!options.back) {
    poly(
      ctx,
      [
        [x + dir * 1.2, y - 20.6],
        [x + dir * 6, y - 19.2],
        [x + dir * 1.2, y - 18.6],
      ],
      look.skin,
    );
    for (const ex of [-1.6, 1.4]) {
      oval(ctx, x + ex + dir * 0.6, y - 21, 0.7, 0.7, palette.gold);
      oval(ctx, x + ex + dir * 0.8, y - 21, 0.35, 0.35, palette.ink);
    }
  }
  if (look.cap) helmet(ctx, x, y - 22, look.cap);
  if (options.player) {
    const hop = Math.sin((options.t ?? 0) * 5) * 1.5;
    poly(
      ctx,
      [
        [x - 4, y - 36 + hop],
        [x + 4, y - 36 + hop],
        [x, y - 31 + hop],
      ],
      palette.gold,
    );
  }
}

function cart(ctx: Ctx, prop: Prop, t: number) {
  const kind = prop.variant % CART_KINDS.length;
  const x = prop.x + 0.18;
  const y = prop.y + 0.3;
  const w = 0.64;
  const d = 0.45;
  const look = visitorLook(prop.x + prop.y);
  // The vendor stands behind the cart.
  const vendor = at(prop.x + 0.5, prop.y + 0.12);
  person(ctx, vendor[0], vendor[1], { ...look, shirt: palette.cream, cap: palette.hideDark });
  poly(ctx, rectPoints({ x: x + 0.15, y: y + 0.15, w, h: d }), palette.shadow);

  const cloth = kind === 0 ? palette.red : kind === 1 ? palette.pink : palette.blue;
  box(ctx, x, y, w, d, 5, 14, palette.woodLight, palette.wood, palette.woodDark);
  stripedWall(ctx, { x, y: y + d }, { x: x + w, y: y + d }, 9, 3, 6, [palette.cream, cloth]);
  const wheelAt = at(x + w * 0.3, y + d + 0.02, 5);
  wheel(ctx, wheelAt[0], wheelAt[1], 5);
  const top = at(x + w / 2, y + d / 2, 19);

  if (kind === 0) {
    box(
      ctx,
      x + 0.06,
      y + 0.06,
      w - 0.12,
      d - 0.12,
      19,
      10,
      palette.glass,
      palette.glassSide,
      palette.glassShade,
    );
    for (let i = 0; i < 9; i++)
      oval(
        ctx,
        top[0] - 8 + (i % 5) * 4,
        top[1] - 3 - Math.floor(i / 5) * 3 - (i % 2),
        2,
        2,
        palette.cream,
      );
    box(ctx, x, y, w, d, 29, 2, palette.scrap, palette.scrap, palette.metalShade);
  } else if (kind === 1) {
    // Three puffball mushrooms.
    for (let i = 0; i < 3; i++) {
      const sx = top[0] - 7 + i * 7;
      const bob = Math.sin(t * 2 + i) * 0.5;
      stroke(
        ctx,
        [
          [sx, top[1]],
          [sx, top[1] - 9],
        ],
        palette.cream,
        1.6,
      );
      ctx.fillStyle = palette.red;
      ctx.beginPath();
      ctx.ellipse(sx, top[1] - 9 + bob, 4.5, 4.5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      oval(ctx, sx - 1.8, top[1] - 11 + bob, 0.9, 0.9, palette.cream);
      oval(ctx, sx + 1.5, top[1] - 12 + bob, 0.9, 0.9, palette.cream);
    }
  } else if (kind === 2) {
    stroke(ctx, [top, [top[0], top[1] - 22]], palette.woodDark, 1.2);
    dome(ctx, [top[0], top[1] - 18], 0.75, 0, 9, HIDE, 0, 10);
    for (let i = 0; i < 3; i++)
      oval(
        ctx,
        top[0] - 6 + i * 6,
        top[1] - 2,
        2.5,
        2.5,
        [palette.pink, palette.cream, palette.woodLight][i],
      );
  } else {
    // A giant tankard on the roof.
    const [cx, cy] = top;
    ctx.strokeStyle = palette.woodDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 13);
    ctx.quadraticCurveTo(cx + 12, cy - 8, cx + 5.5, cy - 3);
    ctx.stroke();
    poly(
      ctx,
      [
        [cx - 5, cy],
        [cx + 5, cy],
        [cx + 7, cy - 16],
        [cx - 7, cy - 16],
      ],
      palette.wood,
    );
    for (const band of [3, 12])
      poly(
        ctx,
        [
          [cx - 5.4, cy - band],
          [cx + 5.4, cy - band],
          [cx + 5.6, cy - band - 1.5],
          [cx - 5.6, cy - band - 1.5],
        ],
        palette.metalShade,
      );
    oval(ctx, cx, cy - 16, 7, 2.5, palette.cream);
  }

  // A little sign above it all.
  const sign = at(prop.x + 0.5, prop.y + 0.5, kind === 2 ? 50 : 42);
  onPlane(ctx, sign, () =>
    signBoard(ctx, CART_KINDS[kind].toUpperCase(), 30, 9, {
      board: palette.board,
      edge: palette.woodDark,
      text: palette.ink,
    }),
  );
}

function ticketBooth(ctx: Ctx, prop: Prop) {
  const x = prop.x + 0.15;
  const y = prop.y + 0.15;
  poly(ctx, rectPoints({ x: x + 0.2, y: y + 0.2, w: 0.7, h: 0.7 }), palette.shadow);
  box(ctx, x, y, 0.7, 0.7, 0, 0, palette.woodLight, palette.wood, palette.woodDark);
  stripedWall(ctx, { x, y: y + 0.7 }, { x: x + 0.7, y: y + 0.7 }, 0, 26, 5, [
    palette.woodLight,
    palette.wood,
    palette.scrap,
  ]);
  stripedWall(ctx, { x: x + 0.7, y: y + 0.7 }, { x: x + 0.7, y }, 0, 26, 5, [
    palette.wood,
    palette.woodDark,
  ]);
  poly(
    ctx,
    [
      at(x + 0.15, y + 0.7, 10),
      at(x + 0.55, y + 0.7, 10),
      at(x + 0.55, y + 0.7, 20),
      at(x + 0.15, y + 0.7, 20),
    ],
    palette.opening,
  );
  for (let i = 0; i < 6; i++) {
    const xa = lerp(x - 0.05, x + 0.75, i / 6);
    const xb = lerp(x - 0.05, x + 0.75, (i + 1) / 6);
    poly(
      ctx,
      [at(xa, y + 0.7, 23), at(xb, y + 0.7, 23), at(xb, y + 0.95, 17), at(xa, y + 0.95, 17)],
      i % 2 ? palette.hide : palette.hideShade,
    );
  }
  raggedHem(ctx, { x: x - 0.05, y: y + 0.95 }, { x: x + 0.75, y: y + 0.95 }, 17, 6, 1.5, [
    palette.hide,
    palette.hideShade,
  ]);
  box(
    ctx,
    x - 0.05,
    y - 0.05,
    0.8,
    0.8,
    26,
    3,
    palette.scrap,
    palette.metalShade,
    palette.metalShade,
  );
  for (let i = 0; i < 3; i++) {
    const [sx, sy] = at(x + 0.1 + i * 0.3, y + 0.75, 29);
    poly(
      ctx,
      [
        [sx - 1.2, sy],
        [sx + 1.2, sy],
        [sx, sy - 5],
      ],
      palette.metal,
    );
  }
  onPlane(ctx, at(x + 0.35, y + 0.35, 38), () =>
    signBoard(ctx, 'TICKETS', 28, 9, {
      board: palette.cream,
      edge: palette.woodDark,
      text: palette.red,
    }),
  );
}

/** Two stumps with a split log across them. */
function bench(ctx: Ctx, prop: Prop) {
  const x = prop.x + 0.12;
  const y = prop.y + 0.4;
  for (const lx of [x + 0.1, x + 0.66]) {
    const [sx, sy] = at(lx, y + 0.13);
    poly(
      ctx,
      [
        [sx - 3.5, sy],
        [sx + 3.5, sy],
        [sx + 3.5, sy - 6],
        [sx - 3.5, sy - 6],
      ],
      palette.wood,
    );
    oval(ctx, sx, sy, 3.5, 1.8, palette.wood);
    oval(ctx, sx, sy - 6, 3.5, 1.8, palette.woodLight);
  }
  box(ctx, x, y, 0.76, 0.26, 6, 3, palette.woodLight, palette.wood, palette.woodDark);
}

/** A heap of scrap: a tilted plate, a broken wheel, a rusty bucket and two planks. */
function planter(ctx: Ctx, prop: Prop) {
  const c = at(prop.x + 0.5, prop.y + 0.5);
  const [x, y] = c;
  oval(ctx, x + 3, y + 1, 10, 4, palette.shadow);
  poly(
    ctx,
    [
      [x - 8, y - 2],
      [x + 2, y - 7],
      [x + 6, y - 16],
      [x - 4, y - 12],
    ],
    palette.scrap,
  );
  ctx.strokeStyle = palette.woodDark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x + 4, y - 2, 7, Math.PI * 1.05, Math.PI * 1.75);
  ctx.moveTo(x + 4, y - 2);
  ctx.lineTo(x + 4 + Math.cos(Math.PI * 1.4) * 7, y - 2 + Math.sin(Math.PI * 1.4) * 7);
  ctx.stroke();
  poly(
    ctx,
    [
      [x - 5, y],
      [x - 1, y],
      [x - 0.5, y - 5],
      [x - 5.5, y - 5],
    ],
    palette.rust,
  );
  ctx.strokeStyle = palette.wood;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 1);
  ctx.lineTo(x + 7, y - 20);
  ctx.moveTo(x + 8, y);
  ctx.lineTo(x - 3, y - 18);
  ctx.stroke();
}

/** A war-banner standard: a pole, a crossbar and a swallowtail banner. */
function balloons(ctx: Ctx, prop: Prop, t: number) {
  const [x, y] = at(prop.x + 0.5, prop.y + 0.5);
  oval(ctx, x + 2, y + 1, 5, 2, palette.shadow);
  const top = y - 48;
  ctx.strokeStyle = palette.woodDark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, top);
  ctx.moveTo(x - 7, top + 2);
  ctx.lineTo(x + 7, top + 2);
  ctx.stroke();
  const color = palette.bunting[prop.x % palette.bunting.length];
  const wave = Math.sin(t * 3 + prop.x) * 1.5;
  poly(
    ctx,
    [
      [x - 6, top + 3],
      [x + 6, top + 3],
      [x + 6 + wave, top + 23],
      [x + wave, top + 17],
      [x - 6 + wave, top + 23],
    ],
    color,
  );
  oval(ctx, x + wave * 0.4, top + 11, 3.5, 3.5, palette.cream);
  oval(ctx, x + 2 + wave * 0.4, top + 11, 3.5, 3.5, color);
}

/** How high a billboard's sign stands, to the bottom of its board. */
const BILLBOARD_HEIGHT = 40;

/**
 * The billboard's sign, in plane-local pixels: the banner plus its gold frame.
 * The board keeps the banner image's shape, 4 by 1.
 */
const BILLBOARD_SIGN = { width: 144, height: 36, frame: 3 };

let banner: HTMLImageElement | undefined;

/** The AI DevCon banner, loaded the first time the billboard is drawn. */
function bannerImage(): HTMLImageElement {
  if (!banner) {
    banner = new Image();
    banner.src = bannerUrl;
  }
  return banner;
}

/** Where a billboard's posts stand, and the point its sign is centred on. */
function billboardFrame(prop: Prop) {
  const y = prop.y + 0.5;
  const left = prop.x + 0.35;
  const right = prop.x + prop.w - 0.35;
  return { y, left, right, centre: at((left + right) / 2, y, BILLBOARD_HEIGHT + 18) };
}

/**
 * The screen box a billboard covers, sign and posts, for clicks and fading.
 * The sign sits on a slanted plane (see onPlane), so its corners are mapped
 * with the same 0.894 and 0.447 factors.
 */
function billboardBounds(prop: Prop): Box {
  const { y, left, right, centre } = billboardFrame(prop);
  const halfWidth = BILLBOARD_SIGN.width / 2 + BILLBOARD_SIGN.frame;
  const halfHeight = BILLBOARD_SIGN.height / 2 + BILLBOARD_SIGN.frame;
  const feet = [at(left, y), at(right, y)];
  return {
    left: Math.min(centre[0] - 0.894 * halfWidth, ...feet.map((p) => p[0])),
    right: Math.max(centre[0] + 0.894 * halfWidth, ...feet.map((p) => p[0])),
    top: centre[1] - 0.447 * halfWidth - halfHeight,
    bottom: Math.max(centre[1] + 0.447 * halfWidth + halfHeight, ...feet.map((p) => p[1])),
  };
}

/** The AI DevCon billboard: the event banner, torchlit, on two timber posts. Clicking it opens the event page. */
function billboard(ctx: Ctx, prop: Prop, t: number) {
  const { y, left, right, centre } = billboardFrame(prop);
  poly(
    ctx,
    rectPoints({ x: prop.x + 0.3, y: prop.y + 0.4, w: prop.w - 0.4, h: 0.5 }),
    palette.shadow,
  );
  for (const px of [left, right]) {
    box(
      ctx,
      px - 0.07,
      y - 0.07,
      0.14,
      0.14,
      0,
      BILLBOARD_HEIGHT + 12,
      palette.woodLight,
      palette.wood,
      palette.woodDark,
    );
  }
  // An X brace between the posts.
  const [l0, l1] = [at(left, y, 4), at(left, y, BILLBOARD_HEIGHT)];
  const [r0, r1] = [at(right, y, 4), at(right, y, BILLBOARD_HEIGHT)];
  ctx.strokeStyle = palette.woodDark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(l0[0], l0[1]);
  ctx.lineTo(r1[0], r1[1]);
  ctx.moveTo(r0[0], r0[1]);
  ctx.lineTo(l1[0], l1[1]);
  ctx.stroke();
  onPlane(ctx, centre, () => {
    const { width, height, frame } = BILLBOARD_SIGN;
    ctx.fillStyle = palette.wood;
    ctx.beginPath();
    ctx.roundRect(
      -width / 2 - frame,
      -height / 2 - frame,
      width + frame * 2,
      height + frame * 2,
      2,
    );
    ctx.fill();
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 2);
    ctx.fill();
    // Until the banner loads, the board stays plain.
    const image = bannerImage();
    if (image.complete && image.naturalWidth > 0) {
      ctx.save();
      ctx.clip();
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    }
    ctx.fillStyle = palette.metalShade;
    for (const cx of [-1, 1])
      for (const cy of [-1, 1])
        ctx.fillRect(
          cx * (width / 2 + frame) - (cx > 0 ? 3 : 0),
          cy * (height / 2 + frame) - (cy > 0 ? 3 : 0),
          3,
          3,
        );
  });
  for (const px of [left, right]) {
    const top = at(px, y, BILLBOARD_HEIGHT + 12);
    flame(ctx, top[0], top[1], t + px);
  }
}

/** How high the top of a bunting pole is. */
const POLE_HEIGHT = 44;

/** A lashed stake with a torch on top. */
function buntingPole(ctx: Ctx, prop: Prop, t: number) {
  const [x, y] = at(prop.x + 0.5, prop.y + 0.5);
  oval(ctx, x + 2, y + 1, 4, 1.6, palette.shadow);
  poly(
    ctx,
    [
      [x - 1.3, y],
      [x + 1.3, y],
      [x + 1.3, y - POLE_HEIGHT],
      [x - 1.3, y - POLE_HEIGHT],
    ],
    palette.woodDark,
  );
  for (let z = 4; z < POLE_HEIGHT - 4; z += 8)
    poly(
      ctx,
      [
        [x - 1.3, y - z],
        [x + 1.3, y - z - 2],
        [x + 1.3, y - z - 5],
        [x - 1.3, y - z - 3],
      ],
      palette.rope,
    );
  const top = y - POLE_HEIGHT;
  flame(ctx, x, top - 1, t);
  poly(
    ctx,
    [
      [x - 2, top - 2],
      [x + 2, top - 2],
      [x + 1.5, top + 1],
      [x - 1.5, top + 1],
    ],
    palette.metalShade,
  );
}

/** War-banner lines between the poles, skipping any strung outside the view. */
export function drawBunting(ctx: Ctx, map: MidwayMap, t: number, view: Box) {
  map.bunting.forEach(([a, b], n) => {
    const p = at(a.x + 0.5, a.y + 0.5, POLE_HEIGHT - 2);
    const q = at(b.x + 0.5, b.y + 0.5, POLE_HEIGHT - 2);
    if (Math.max(p[0], q[0]) < view.left || Math.min(p[0], q[0]) > view.right) return;
    if (Math.max(p[1], q[1]) + 20 < view.top || Math.min(p[1], q[1]) > view.bottom) return;
    const sag = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.12;
    const points: Pt[] = [];
    const count = 12;
    for (let i = 0; i <= count; i++) {
      const s = i / count;
      points.push([lerp(p[0], q[0], s), lerp(p[1], q[1], s) + 4 * sag * s * (1 - s)]);
    }
    stroke(ctx, points, palette.rope, 0.8);
    flags(ctx, points, t, 4, n);
  });
}

/** A treadwheel siege-wheel, spiked, with crates for cars. */
function ferrisWheel(ctx: Ctx, prop: Prop, t: number) {
  const cx = prop.x + prop.w / 2;
  const cy = prop.y + prop.h / 2;
  const radius = 60;
  const hubZ = 76;
  const spread = 0.28;
  const turn = t * 0.2;
  const cars = 10;
  const hubAt = (offset: number) => at(cx, cy + offset, hubZ);
  const onWheel = (offset: number, angle: number, r = radius): Pt => {
    const [hx, hy] = hubAt(offset);
    return [
      hx + Math.cos(angle) * r * 0.894,
      hy + Math.cos(angle) * r * 0.447 - Math.sin(angle) * r,
    ];
  };
  const ring = (offset: number, r: number, color: string, width: number) => {
    const points: Pt[] = [];
    for (let i = 0; i <= 48; i++) points.push(onWheel(offset, (i / 48) * Math.PI * 2, r));
    stroke(ctx, points, color, width);
  };
  const legs = (offset: number, color: string) => {
    stroke(ctx, [at(cx - 1.4, cy + offset), hubAt(offset), at(cx + 1.4, cy + offset)], color, 4.5);
  };

  const base = at(cx, cy);
  oval(ctx, base[0] + 10, base[1] + 4, 44, 14, palette.shadow);
  legs(-spread - 0.15, palette.woodDark);
  for (const side of [-spread, spread]) {
    if (side > 0) {
      // The crates hang between the two rims.
      for (let i = 0; i < cars; i++) {
        const angle = turn + (i / cars) * Math.PI * 2;
        const [gx, gy] = onWheel(0, angle);
        stroke(
          ctx,
          [
            [gx, gy],
            [gx, gy + 4],
          ],
          palette.rope,
          1,
        );
        ctx.fillStyle = palette.wood;
        ctx.beginPath();
        ctx.roundRect(gx - 5, gy + 4, 10, 8, 1);
        ctx.fill();
        poly(
          ctx,
          [
            [gx - 6, gy + 4],
            [gx + 6, gy + 4],
            [gx + 4, gy + 1.5],
            [gx - 4, gy + 1.5],
          ],
          palette.hide,
        );
        poly(
          ctx,
          [
            [gx - 5, gy + 7.5],
            [gx + 5, gy + 7.5],
            [gx + 5, gy + 9],
            [gx - 5, gy + 9],
          ],
          palette.metalShade,
        );
      }
    }
    ctx.strokeStyle = palette.woodLight;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < cars; i++) {
      const angle = turn + (i / cars) * Math.PI * 2;
      const [hx, hy] = hubAt(side);
      const [rx, ry] = onWheel(side, angle);
      ctx.moveTo(hx, hy);
      ctx.lineTo(rx, ry);
    }
    ctx.stroke();
    ring(side, radius * 0.6, palette.rope, 4);
    ring(side, radius, side > 0 ? palette.wood : palette.woodDark, 4.5);
  }
  // Spikes round the front rim.
  ctx.fillStyle = palette.metal;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = turn + ((i + 0.5) / 10) * Math.PI * 2;
    const a = onWheel(spread, angle - 0.03, radius + 1.5);
    const b = onWheel(spread, angle + 0.03, radius + 1.5);
    const tip = onWheel(spread, angle, radius + 5);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
  }
  ctx.fill();
  stroke(ctx, [hubAt(-spread), hubAt(spread)], palette.woodDark, 4);
  const hub = hubAt(spread);
  oval(ctx, hub[0], hub[1], 7, 7, palette.wood);
  oval(ctx, hub[0], hub[1], 3.5, 3.5, palette.woodDark);
  legs(spread + 0.15, palette.wood);
  box(ctx, cx - 0.6, cy - 0.5, 1.2, 1, 0, 4, palette.scrap, palette.scrap, palette.metalShade);
}

// ── Booths ────────────────────────────────────────────────────────────────

const BOOTH_SCHEMES = [
  { awning: [palette.red, palette.hide], awningShade: [palette.redShade, palette.hideShade] },
  { awning: [palette.gold, palette.hideDark], awningShade: [palette.goldShade, palette.hideDark] },
  { awning: [palette.blue, palette.hide], awningShade: [palette.blueShade, palette.hideShade] },
  { awning: [palette.sky2, palette.hideDark], awningShade: [palette.grassEdge, palette.hideDark] },
] as const;
const CLOSED_SCHEME = {
  awning: [palette.closed, palette.metal],
  awningShade: [palette.closedShade, palette.metalShade],
} as const;

const BOOTH_WALL = 34;
/** How far above a booth's footprint its sign hangs. */
export const BOOTH_SIGN_HEIGHT = BOOTH_WALL + 22;

function target(ctx: Ctx, r: number) {
  const rings = [palette.red, palette.cream, palette.red, palette.cream];
  rings.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * (1 - i / rings.length), 0, Math.PI * 2);
    ctx.fill();
  });
}

/** One awning strip, as a patch inset 20% with two stitches when `patch` is set. */
function awningStrip(ctx: Ctx, quad: Pt[], color: string, patch: boolean) {
  poly(ctx, quad, color);
  if (!patch) return;
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4;
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4;
  const inset = quad.map(([x, y]): Pt => [lerp(x, cx, 0.2), lerp(y, cy, 0.2)]);
  poly(ctx, inset, palette.hideDark);
  ctx.strokeStyle = palette.cream;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const s of [0.35, 0.65]) {
    const [x, y] = [lerp(inset[0][0], inset[3][0], s), lerp(inset[0][1], inset[3][1], s)];
    ctx.moveTo(x - 1, y - 0.5);
    ctx.lineTo(x + 1, y + 0.5);
  }
  ctx.stroke();
}

/** A scrap-plank hut with a corrugated roof, hide awnings and a torchlit sign. */
function booth(ctx: Ctx, slot: BoothSlot, name: string, t: number, glow: boolean) {
  const open = slot.gameId !== undefined;
  const scheme = open ? BOOTH_SCHEMES[slot.index % BOOTH_SCHEMES.length] : CLOSED_SCHEME;
  const x0 = slot.x + 0.15;
  const y0 = slot.y + 0.15;
  const s = 1.7;
  const x1 = x0 + s;
  const y1 = y0 + s;
  const wall = BOOTH_WALL;
  const r = 0.06;

  if (glow) {
    const [gx, gy] = at(x1, y1);
    oval(ctx, gx, gy, 40, 18, palette.torchGlowCore);
  }
  poly(ctx, rectPoints({ x: x0 + 0.35, y: y0 + 0.35, w: s, h: s }), palette.shadow);
  box(ctx, x0, y0, s, s, wall, 0, palette.wood, palette.wood, palette.wood);

  // A corrugated scrap roof, set inside the plank walls.
  box(
    ctx,
    x0 - r,
    y0 - r,
    s + r * 2,
    s + r * 2,
    wall,
    3,
    palette.scrap,
    palette.metalShade,
    palette.metalShade,
  );
  for (let i = 1; i < 6; i += 2) {
    const xa = lerp(x0 - r, x1 + r, i / 6);
    const xb = lerp(x0 - r, x1 + r, (i + 1) / 6);
    poly(
      ctx,
      [
        at(xa, y0 - r, wall + 3),
        at(xb, y0 - r, wall + 3),
        at(xb, y1 + r, wall + 3),
        at(xa, y1 + r, wall + 3),
      ],
      palette.metal,
    );
  }
  for (const [nx, ny] of [
    [x0 + 0.2, y0 + 0.2],
    [x1 - 0.2, y0 + 0.2],
    [x0 + 0.2, y1 - 0.2],
    [x1 - 0.2, y1 - 0.2],
  ]) {
    const [px, py] = at(nx, ny, wall + 3);
    oval(ctx, px, py, 0.8, 0.8, palette.woodDark);
  }

  // Plank walls on the two faces we can see, their tops pointed and uneven.
  const front = open
    ? [palette.woodLight, palette.wood, palette.scrap]
    : [palette.closed, palette.closedShade];
  const side = open ? [palette.wood, palette.woodDark] : [palette.closedShade, palette.closed];
  stripedWall(ctx, { x: x0, y: y1 }, { x: x1, y: y1 }, 0, wall, 7, front, slot.index);
  stripedWall(ctx, { x: x1, y: y1 }, { x: x1, y: y0 }, 0, wall, 7, side, slot.index);

  // A window and counter on both faces we can see.
  const windows = [
    { a: { x: x0 + 0.15, y: y1 }, b: { x: x1 - 0.15, y: y1 }, out: { x: 0, y: 1 } },
    { a: { x: x1, y: y1 - 0.15 }, b: { x: x1, y: y0 + 0.15 }, out: { x: 1, y: 0 } },
  ];
  windows.forEach(({ a, b, out }, face) => {
    const corners = [
      at(a.x, a.y, 9),
      at(b.x, b.y, 9),
      at(b.x, b.y, wall - 7),
      at(a.x, a.y, wall - 7),
    ];
    poly(ctx, corners, palette.opening);
    if (open) {
      // Crude trophies: horned helmets and pickled jars.
      for (let i = 0; i < 4; i++) {
        const p = at(lerp(a.x, b.x, (i + 0.5) / 4), lerp(a.y, b.y, (i + 0.5) / 4), 13);
        const hop = Math.sin(t * 2 + i + slot.index + face) > 0.9 ? 1.5 : 0;
        const [px, py] = [p[0], p[1] - hop];
        if ((i + face) % 2 === 0) {
          horns(ctx, px, py - 1, 3, 1);
          ctx.fillStyle = palette.metal;
          ctx.beginPath();
          ctx.ellipse(px, py, 2.6, 2.6, 0, Math.PI, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = palette.sky2;
          ctx.beginPath();
          ctx.roundRect(px - 1.5, py - 3, 3, 4, 0.8);
          ctx.fill();
          stroke(
            ctx,
            [
              [px - 1.7, py - 3],
              [px + 1.7, py - 3],
            ],
            palette.woodDark,
            1,
          );
        }
      }
    } else {
      // Boarded up: two crossed planks, nailed on.
      ctx.strokeStyle = palette.closed;
      ctx.lineWidth = 3;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      ctx.lineTo(corners[2][0], corners[2][1]);
      ctx.moveTo(corners[1][0], corners[1][1]);
      ctx.lineTo(corners[3][0], corners[3][1]);
      ctx.stroke();
      for (const corner of [corners[2], corners[3]])
        oval(
          ctx,
          lerp(corner[0], (corners[0][0] + corners[1][0]) / 2, 0.15),
          lerp(corner[1], (corners[0][1] + corners[2][1]) / 2, 0.15),
          0.9,
          0.9,
          palette.woodDark,
        );
    }
    const lip = 0.14;
    const aOut = { x: a.x + out.x * lip, y: a.y + out.y * lip };
    const bOut = { x: b.x + out.x * lip, y: b.y + out.y * lip };
    poly(
      ctx,
      [at(a.x, a.y, 9), at(b.x, b.y, 9), at(bOut.x, bOut.y, 9), at(aOut.x, aOut.y, 9)],
      palette.woodLight,
    );
    poly(
      ctx,
      [at(aOut.x, aOut.y, 9), at(bOut.x, bOut.y, 9), at(bOut.x, bOut.y, 7), at(aOut.x, aOut.y, 7)],
      palette.woodDark,
    );
  });

  // Corner posts, sharpened to a bone-white point.
  const post = 0.12;
  const posts = [
    { x: x0, y: y1 - post },
    { x: x1 - post, y: y1 - post },
    { x: x1 - post, y: y0 },
  ];
  for (const p of posts) {
    box(
      ctx,
      p.x,
      p.y,
      post,
      post,
      0,
      wall + 8,
      palette.woodDark,
      palette.woodDark,
      palette.woodDark,
    );
    const [px, py] = at(p.x + post / 2, p.y + post / 2, wall + 8);
    poly(
      ctx,
      [
        [px - 2, py + 1],
        [px + 2, py + 1],
        [px, py - 3],
      ],
      palette.cream,
    );
  }

  // The hut's outer silhouette, so the wood stands off the grass.
  const silhouette: Pt[] = [
    at(x0, y1, 0),
    at(x1, y1, 0),
    at(x1, y0, 0),
    at(x1, y0, wall),
    at(x1 + r, y0 - r, wall + 3),
    at(x0 - r, y0 - r, wall + 3),
    at(x0 - r, y1 + r, wall + 3),
    at(x0, y1, wall),
  ];
  outline(ctx, silhouette);
  if (glow) {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(t * 4));
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(silhouette[0][0], silhouette[0][1]);
    for (const [px, py] of silhouette.slice(1)) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  if (open) {
    const [px, py] = at(x0 + post / 2, y1 - post / 2, wall + 11);
    flag(ctx, px, py, t + slot.index, scheme.awning[0], 0.7);
  }

  // Ragged hide awnings over each window.
  const reach = open ? 0.42 : 0.12;
  const strips = 8;
  for (let i = 0; i < strips; i++) {
    const ya = lerp(y1 + r, y0 - r, i / strips);
    const yb = lerp(y1 + r, y0 - r, (i + 1) / strips);
    awningStrip(
      ctx,
      [
        at(x1 + r, ya, wall),
        at(x1 + r, yb, wall),
        at(x1 + r + reach, yb, wall - 8),
        at(x1 + r + reach, ya, wall - 8),
      ],
      scheme.awningShade[i % 2],
      open && i % 3 === 2,
    );
  }
  raggedHem(
    ctx,
    { x: x1 + r + reach, y: y1 + r },
    { x: x1 + r + reach, y: y0 - r },
    wall - 8,
    strips,
    2.5,
    scheme.awningShade,
  );
  for (let i = 0; i < strips; i++) {
    const xa = lerp(x0 - r, x1 + r, i / strips);
    const xb = lerp(x0 - r, x1 + r, (i + 1) / strips);
    awningStrip(
      ctx,
      [
        at(xa, y1 + r, wall),
        at(xb, y1 + r, wall),
        at(xb, y1 + r + reach, wall - 8),
        at(xa, y1 + r + reach, wall - 8),
      ],
      scheme.awning[i % 2],
      open && i % 3 === 2,
    );
  }
  raggedHem(
    ctx,
    { x: x0 - r, y: y1 + r + reach },
    { x: x1 + r, y: y1 + r + reach },
    wall - 8,
    strips,
    2.5,
    scheme.awning,
  );

  // The sign on the roof, with the game's name on it and a torch on each post.
  const signAt = at(x0 + s / 2, y0 + s / 2, BOOTH_SIGN_HEIGHT - 6);
  onPlane(ctx, signAt, () => {
    ctx.fillStyle = palette.woodDark;
    ctx.fillRect(-21, -12, 2, 26);
    ctx.fillRect(19, -12, 2, 26);
    if (open) {
      ctx.save();
      ctx.translate(0, -18);
      target(ctx, 9);
      ctx.restore();
    }
    signBoard(
      ctx,
      name,
      60,
      16,
      open
        ? { board: palette.cream, edge: palette.woodDark, text: palette.red }
        : { board: palette.metal, edge: palette.closedShade, text: palette.closedShade },
      glow,
    );
    if (open) for (const px of [-20, 20]) flame(ctx, px, -12, t + slot.index);
  });
}

// ── Bounds, for clicks and for fading things in front of the player ───────

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The screen box a booth and its sign are drawn in. */
export function boothBounds(slot: BoothSlot): Box {
  const c = toScreen(slot.x + 1, slot.y + 1);
  return { left: c.x - 32, right: c.x + 32, top: c.y - BOOTH_SIGN_HEIGHT - 30, bottom: c.y + 18 };
}

const PROP_HEIGHTS: Record<Prop['kind'], number> = {
  'big-top': 110,
  'round-tent': 86,
  'peaked-tent': 64,
  'ferris-wheel': 150,
  carousel: 86,
  wagon: 40,
  cart: 50,
  'ticket-booth': 46,
  bench: 16,
  planter: 22,
  balloons: 52,
  'bunting-pole': 0,
  billboard: BILLBOARD_HEIGHT + 40,
};

/** Roughly the screen box a prop is drawn in. */
export function propBounds(prop: Prop): Box {
  if (prop.kind === 'billboard') return billboardBounds(prop);
  const c = toScreen(prop.x + prop.w / 2, prop.y + prop.h / 2);
  const half = ((prop.w + prop.h) * 16) / 2;
  const footprint = ((prop.w + prop.h) * 8) / 2;
  return {
    left: c.x - half,
    right: c.x + half,
    top: c.y - footprint - PROP_HEIGHTS[prop.kind],
    bottom: c.y + footprint,
  };
}

// ── People ────────────────────────────────────────────────────────────────

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  cap?: string;
}

export function visitorLook(n: number): Look {
  return {
    skin: palette.skins[n % palette.skins.length],
    hair: palette.hairs[(n * 3 + 1) % palette.hairs.length],
    shirt: palette.shirts[(n * 2 + 1) % palette.shirts.length],
    pants: palette.pants[n % palette.pants.length],
  };
}

export const PLAYER_LOOK: Look = {
  skin: palette.skins[0],
  hair: palette.hairs[2],
  shirt: palette.red,
  pants: palette.pants[0],
  cap: palette.metal,
};

export function drawWalker(ctx: Ctx, walker: Walker, look: Look, player = false, t = 0) {
  const p = toScreen(walker.x, walker.y);
  const swing = walker.walking ? Math.sin(walker.stride * Math.PI * 2.2) : 0;
  person(ctx, p.x, p.y, look, {
    swing,
    back: walker.facing === 'back',
    dir: walker.flipped ? -1 : 1,
    player,
    t,
  });
}

// ── The gate ──────────────────────────────────────────────────────────────

const ARCH_HEIGHT = 70;
const ARCH_LEFT = -0.45;
const ARCH_RIGHT = 2.2;
/** How tall the gate's two timber towers stand, to the foot of their pointed tops. */
const TOWER_HEIGHT = 58;
const TOWER = 0.36;

export function archBounds(map: MidwayMap): Box {
  const y = map.height - 1;
  const left = toScreen(map.avenueX + ARCH_LEFT - 0.6, y + 0.3);
  const right = toScreen(map.avenueX + ARCH_RIGHT + 0.8, y - 0.3);
  return { left: left.x, right: right.x, top: right.y - ARCH_HEIGHT - 26, bottom: left.y };
}

/** A lashed timber tower with a pointed top and a brazier. */
function tower(ctx: Ctx, x: number, y: number, t: number) {
  box(ctx, x, y, TOWER, TOWER, 0, TOWER_HEIGHT, palette.woodLight, palette.wood, palette.woodDark);
  for (const z of [14, 30, 46])
    box(
      ctx,
      x - 0.01,
      y - 0.01,
      TOWER + 0.02,
      TOWER + 0.02,
      z,
      2,
      palette.rope,
      palette.rope,
      palette.rope,
    );
  const peak = at(x + TOWER / 2, y + TOWER / 2, TOWER_HEIGHT + 10);
  const front = at(x, y + TOWER, TOWER_HEIGHT);
  const corner = at(x + TOWER, y + TOWER, TOWER_HEIGHT);
  const back = at(x + TOWER, y, TOWER_HEIGHT);
  poly(ctx, [front, corner, peak], palette.woodLight);
  poly(ctx, [corner, back, peak], palette.wood);
  const side = at(x + TOWER + 0.04, y + TOWER / 2, TOWER_HEIGHT - 6);
  stroke(ctx, [side, [side[0] + 8, side[1]]], palette.woodDark, 1.2);
  flag(ctx, side[0] + 8, side[1], t + x, palette.red, 0.8);
  // The brazier hangs off the front corner.
  const [bx, by] = at(x, y + TOWER + 0.05, TOWER_HEIGHT - 2);
  flame(ctx, bx, by - 1, t + x, 1.4);
  poly(
    ctx,
    [
      [bx - 5, by - 2],
      [bx + 5, by - 2],
      [bx + 3, by + 2],
      [bx - 3, by + 2],
    ],
    palette.metalShade,
  );
}

export function drawArch(ctx: Ctx, map: MidwayMap, t: number) {
  const y = map.height - 0.75;
  const left = map.avenueX + ARCH_LEFT;
  const right = map.avenueX + ARCH_RIGHT;
  for (const px of [left, right]) tower(ctx, px, y - 0.2, t);
  const centre = at((left + right + TOWER) / 2, y, TOWER_HEIGHT + 2);
  onPlane(ctx, centre, () => {
    // A fan of jagged spikes behind a round shield with a bone crescent.
    ctx.fillStyle = palette.metal;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      const len = 20 + (i % 2 ? -3 : 1);
      ctx.moveTo(Math.cos(a - 0.12) * 8, -10 + Math.sin(a - 0.12) * 8);
      ctx.lineTo(Math.cos(a) * len, -10 + Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + 0.12) * 8, -10 + Math.sin(a + 0.12) * 8);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = palette.red;
    ctx.beginPath();
    ctx.ellipse(0, -10, 12, 9, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    oval(ctx, 0, -14, 4, 4, palette.cream);
    oval(ctx, 1.8, -15, 3.4, 3.4, palette.red);
    signBoard(ctx, 'GRUMPSHY THE GOBLIN CARNIVAL', 92, 20, {
      board: palette.wood,
      edge: palette.woodDark,
      text: palette.cream,
    });
    // A sagging chain under the sign, with three lanterns.
    const chain = (s: number) => 13.5 + 3 * 4 * s * (1 - s);
    ctx.strokeStyle = palette.metalShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      if (i === 0) ctx.moveTo(-44, chain(s));
      else ctx.lineTo(-44 + 88 * s, chain(s));
    }
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const s = (i + 1) / 4;
      lantern(ctx, -44 + 88 * s, chain(s) + 3, t, i);
    }
  });
}

// ── The sky ───────────────────────────────────────────────────────────────

export interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
}

export function drawCloud(ctx: Ctx, x: number, y: number, size: number) {
  ctx.fillStyle = palette.cloud;
  ctx.beginPath();
  ctx.roundRect(x - 30 * size, y - 8 * size, 60 * size, 12 * size, 6 * size);
  ctx.arc(x - 14 * size, y - 8 * size, 11 * size, 0, Math.PI * 2);
  ctx.arc(x + 4 * size, y - 13 * size, 15 * size, 0, Math.PI * 2);
  ctx.arc(x + 20 * size, y - 6 * size, 9 * size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.cloudShade;
  ctx.beginPath();
  ctx.roundRect(x - 30 * size, y, 60 * size, 4 * size, 2 * size);
  ctx.fill();
}

export interface Floater {
  x: number;
  y: number;
  age: number;
  color: string;
}

/** Embers rising from the torches into the sky. */
export function drawFloaters(ctx: Ctx, floaters: readonly Floater[]) {
  for (const f of floaters) {
    const alpha = Math.max(0, Math.min(1, 6 - f.age));
    const sway = Math.sin(f.age * 2) * 3;
    ctx.globalAlpha = alpha;
    oval(ctx, f.x + sway, f.y, 1.6, 1.6, f.color);
    ctx.globalAlpha = alpha / 2;
    oval(ctx, f.x + sway, f.y + 4, 1, 1, f.color);
  }
  ctx.globalAlpha = 1;
}

// ── Everything else ───────────────────────────────────────────────────────

export function drawProp(ctx: Ctx, prop: Prop, t: number) {
  switch (prop.kind) {
    case 'big-top':
      return bigTop(ctx, prop, t);
    case 'round-tent': {
      const colors = TENT_COLORS[prop.variant % TENT_COLORS.length];
      return roundTent(
        ctx,
        prop.x + prop.w / 2,
        prop.y + prop.h / 2,
        1.55,
        30,
        34,
        colors,
        t,
        prop.variant % 2 ? palette.blue : palette.gold,
      );
    }
    case 'peaked-tent':
      return peakedTent(ctx, prop, t);
    case 'ferris-wheel':
      return ferrisWheel(ctx, prop, t);
    case 'carousel':
      return carousel(ctx, prop, t);
    case 'wagon':
      return wagon(ctx, prop);
    case 'cart':
      return cart(ctx, prop, t);
    case 'ticket-booth':
      return ticketBooth(ctx, prop);
    case 'bench':
      return bench(ctx, prop);
    case 'planter':
      return planter(ctx, prop);
    case 'balloons':
      return balloons(ctx, prop, t);
    case 'bunting-pole':
      return buntingPole(ctx, prop, t);
    case 'billboard':
      return billboard(ctx, prop, t);
  }
}

export function drawBooth(ctx: Ctx, slot: BoothSlot, name: string, t: number, glow: boolean) {
  booth(ctx, slot, name, t, glow);
}

/** A rounded callout with a line of text, pointing down at a screen point. */
export function label(ctx: Ctx, text: string, x: number, y: number) {
  const { colors, radius } = theme;
  ctx.font = canvasFont('small', 'bold');
  const width = ctx.measureText(text).width + 22;
  const height = theme.font.small + 14;
  ctx.fillStyle = colors.background;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, Math.min(radius, height / 2));
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, y + height / 2);
  ctx.lineTo(x + 6, y + height / 2);
  ctx.lineTo(x, y + height / 2 + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}
