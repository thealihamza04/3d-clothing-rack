import * as THREE from "three";
import { contours } from "d3-contour";
import { Delaunay } from "d3-delaunay";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { GarmentArt } from "@/components/garment-art";
import type { Product } from "./products";

// Turns a garment's front, back and side pictures into a soft 3D piece of clothing.
// The outline of the front picture is traced and filled with a fine mesh. How thick
// the piece is at each height comes from the outline of the side picture, so from
// the side it has the real profile: shoulders, collar, hanging sleeve, hood. Edges
// roll over where front meets back, and a few folds hang from the shoulders. The
// front picture is printed on the front, the back picture on the back, and the side
// picture on whatever faces sideways, blended in the shader as the surface turns.
//
// World units: one unit is one rack slot. Every picture is treated as a 4:5 frame
// PIC_W wide, so pieces keep their sizes relative to each other.

export const PIC_W = 3.4;
export const PIC_H = 4.25;
// Without a side picture: half-thickness at the shoulders and at the hem.
const BODY_TOP = 0.2;
const BODY_HEM = 0.12;
// How far in from the outline the edge takes to round over to full thickness.
const EDGE_ROUND = 0.2;
// Side pictures are read slimmer than they're drawn or shot: cloth on a hanger hangs
// much flatter than on a body or a ghost mannequin. The depth is at most 0.8 of the
// picture's and never more than this share of the piece's front width.
const DEPTH_SCALE = 0.8;
const MAX_DEPTH = 0.26;
// Sleeves (whatever reaches out past the body) are this much of the body's thickness.
const SLEEVE_THICKNESS = 0.4;
// Mesh spacing.
const STEP = 0.05;
// The rolled edge is built along lines this far in from the outline, so it curves
// smoothly all the way round. The rest is filled with a staggered grid.
const EDGE_RINGS = [0.02, 0.045, 0.08, 0.125, 0.18];
const TEX_W = 800;
const TEX_H = 1000;
// Outlines are traced on this grid.
const GRID_W = 192;
const GRID_H = 240;

export type GarmentModel = {
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
  // Highest point of the outline (y is 0 at the top of the picture, negative downward).
  top: number;
  // How the piece hangs, in the same coordinates as the outline. Tops sit on a wooden
  // hanger inside them: its centre under the collar, its arms reaching out to ±reach.
  // Pants hang by the waistband from two clips at ±x, gripping it between z = back and
  // z = front.
  hanger: { kind: "arms"; reach: number; centre: number; end: number } | { kind: "clips"; x: number; front: number; back: number };
};

const cache = new Map<string, Promise<GarmentModel>>();
const built = new Map<string, GarmentModel>();

type Sources = { front?: string; back?: string; side?: string };

const cacheKey = (product: Product, photos: Sources) =>
  `${product.slug}|${photos.front ?? ""}|${photos.back ?? ""}|${photos.side ?? ""}`;

export function loadGarmentModel(product: Product, photos: Sources) {
  const key = cacheKey(product, photos);
  let model = cache.get(key);
  if (!model) {
    model = build(product, photos);
    model.then((m) => built.set(key, m));
    cache.set(key, model);
  }
  return model;
}

// A model that has already been built, so it can be shown on the very first frame.
export function builtGarmentModel(product: Product, photos: Sources) {
  return built.get(cacheKey(product, photos));
}

async function build(product: Product, photos: Sources): Promise<GarmentModel> {
  // This is first called from an effect; drawing the SVG art needs React to be idle.
  await new Promise((resolve) => setTimeout(resolve));
  // Real photos without a side shot fall back to an estimated profile rather than
  // the drawn side, which wouldn't match them.
  const sideSource = photos.side ?? (photos.front ? null : artUrl(product, "side"));
  const [frontImage, backImage, sideImage] = await Promise.all([
    loadImage(photos.front ?? artUrl(product, "front")),
    loadImage(photos.back ?? photos.front ?? artUrl(product, "back")),
    sideSource ? loadImage(sideSource) : null,
  ]);
  const front = drawFramed(frontImage);
  const { points, top, inside, rings } = traceOutline(front);
  const xs = points.map((p) => p.x);
  const frontWidth = Math.max(...xs) - Math.min(...xs);

  const frontTexture = garmentTexture(frontImage, front);
  // The back is seen from behind, so flip it to read the right way round.
  const backTexture = garmentTexture(backImage, drawFramed(backImage), true);

  let profile: Profile = estimatedProfile;
  let sideTexture = frontTexture;
  if (sideImage) {
    const side = drawFramed(sideImage);
    profile = traceProfile(side, frontWidth);
    sideTexture = garmentTexture(sideImage, side);
  }
  if (product.type === "pants") profile = pinchWaist(profile);

  const geometry = buildBody(points, rings, inside, top, profile);
  const materials = [fabricMaterial(frontTexture, sideTexture), fabricMaterial(backTexture, sideTexture)];

  const hanger = product.type === "pants" ? fitClips(inside, top, profile, frontWidth / 2) : fitHanger(points);
  return { geometry, materials, top, hanger };
}

const toUV = (x: number, y: number) => [x / PIC_W + 0.5, 1 + y / PIC_H];

function buildBody(
  outline: THREE.Vector2[],
  rings: Ring[],
  inside: (x: number, y: number) => number,
  top: number,
  profile: Profile,
) {
  const bottom = Math.min(...outline.map((p) => p.y));
  const xs = outline.map((p) => p.x);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];

  // Points along the outline (shared by front and back, where they meet), along the
  // lines just inside it, and a staggered grid of points deeper in. Each knows how
  // far in from the outline it is.
  const rim = densify(outline, STEP);
  const fill: { p: THREE.Vector2; depth: number }[] = [];
  for (const ring of rings) for (const p of densify(ring.points, STEP)) fill.push({ p, depth: ring.depth });
  const gridFrom = EDGE_RINGS[EDGE_RINGS.length - 1] + STEP / 2;
  for (let y = top - STEP / 2, row = 0; y > bottom; y -= STEP * 0.87, row++) {
    for (let x = minX + (row % 2 ? STEP / 2 : 0); x < maxX; x += STEP) {
      const depth = inside(x, y);
      if (depth > gridFrom) fill.push({ p: new THREE.Vector2(x, y), depth });
    }
  }
  const all = [...rim, ...fill.map((f) => f.p)];
  const triangles = Delaunay.from(all, (p) => p.x, (p) => p.y).triangles;
  const bodyHalf = bodyHalfWidth(inside, top - 0.88 * (top - bottom), maxX);

  // Vertices: rim, then the fill points once for the front and once for the back.
  const nRim = rim.length;
  const nFill = fill.length;
  const count = nRim + nFill * 2;
  const position = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const sideUv = new Float32Array(count * 2);
  const put = (i: number, p: THREE.Vector2, z: number) => {
    position.set([p.x, p.y, z], i * 3);
    uv.set(toUV(p.x, p.y), i * 2);
    sideUv.set(profile.uv(p.x, p.y, z, (top - p.y) / (top - bottom)), i * 2);
  };
  rim.forEach((p, i) => {
    const { front, back } = profile.at((top - p.y) / (top - bottom));
    put(i, p, (front + back) / 2);
  });
  fill.forEach(({ p, depth }, i) => {
    const down = (top - p.y) / (top - bottom);
    const { front, back } = thickness(p.x, p.y, depth, down, profile, bodyHalf);
    put(nRim + i, p, front);
    put(nRim + nFill + i, p, back);
  });

  const frontFaces: number[] = [];
  const backFaces: number[] = [];
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t];
    let [b, c] = [triangles[t + 1], triangles[t + 2]];
    const cx = (all[a].x + all[b].x + all[c].x) / 3;
    const cy = (all[a].y + all[b].y + all[c].y) / 3;
    // Delaunay fills the convex hull; drop triangles in the gaps (under the arms etc).
    if (inside(cx, cy) <= 0) continue;
    const ccw = (all[b].x - all[a].x) * (all[c].y - all[a].y) - (all[b].y - all[a].y) * (all[c].x - all[a].x) > 0;
    if (!ccw) [b, c] = [c, b];
    const back = (i: number) => (i < nRim ? i : i + nFill);
    frontFaces.push(a, b, c);
    backFaces.push(back(a), back(c), back(b));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute("sideUv", new THREE.BufferAttribute(sideUv, 2));
  geometry.setIndex([...frontFaces, ...backFaces]);
  geometry.addGroup(0, frontFaces.length, 0);
  geometry.addGroup(frontFaces.length, backFaces.length, 1);
  geometry.computeVertexNormals();
  return geometry;
}

// Half the body's width, measured across the row just above the hem, where only
// the body (not the sleeves) reaches.
function bodyHalfWidth(inside: (x: number, y: number) => number, y: number, fallback: number) {
  if (inside(0, y) <= 0) return fallback;
  let right = 0;
  let left = 0;
  while (inside(right + 0.02, y) > 0) right += 0.02;
  while (inside(left - 0.02, y) > 0) left -= 0.02;
  return Math.max(right, -left);
}

// How far the front and back surfaces sit at a point `depth` in from the outline,
// `down` of the way from the top of the piece to the hem.
function thickness(x: number, y: number, depth: number, down: number, profile: Profile, bodyHalf: number) {
  const { front, back } = profile.at(down);
  const mid = (front + back) / 2;
  // Past the body's sides it's a sleeve: a flatter tube, not the full body depth.
  const past = Math.min(Math.max((Math.abs(x) - bodyHalf + 0.05) / 0.35, 0), 1);
  const half = ((front - back) / 2) * (1 - (1 - SLEEVE_THICKNESS) * past * past * (3 - 2 * past));
  // A quarter-circle profile, so the edge rolls over rather than stopping in a wall.
  // It rolls tightly at the hem, where front and back hang as two thin layers.
  const u = Math.min(depth / (EDGE_ROUND * (1 - 0.75 * down)), 1);
  const round = Math.sqrt(1 - (1 - u) * (1 - u));
  // Long folds that hang from the shoulders and deepen toward the hem.
  const folds =
    (Math.sin(x * 9 + Math.sin(y * 1.3) * 1.2) * 0.6 + Math.sin(x * 21 + y * 0.9 + 1.7) * 0.4) *
    0.02 *
    Math.min(down * 2.5, 1);
  return { front: mid + (half + folds) * round, back: mid - (half - folds * 0.7) * round };
}

// The piece's depth at each height, front surface and back surface (z), and where
// on the side picture a point falls.
type Profile = {
  at: (down: number) => { front: number; back: number };
  uv: (x: number, y: number, z: number, down: number) => number[];
};

const estimatedProfile: Profile = {
  at(down) {
    const half = BODY_TOP + (BODY_HEM - BODY_TOP) * Math.pow(down, 1.6);
    return { front: half, back: -half };
  },
  // No side picture: the sides keep the front picture's colours.
  uv: (x, y) => toUV(x, y),
};

// Reads the side picture's outline row by row. Its front faces right, so the right
// edge is the front surface and the left edge the back. The piece is shifted so its
// shoulders are centred on the hanger.
function traceProfile(picture: HTMLCanvasElement, frontWidth: number): Profile {
  const grid = canvas(GRID_W, GRID_H);
  const ctx = grid.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(picture, 0, 0, GRID_W, GRID_H);
  const { data } = ctx.getImageData(0, 0, GRID_W, GRID_H);
  const toZ = (gx: number) => (gx / GRID_W - 0.5) * PIC_W;

  const alpha = (x: number, y: number) => (x < 0 || x >= GRID_W ? 0 : data[(y * GRID_W + x) * 4 + 3] / 255);

  let rows: { front: number; back: number }[] = [];
  let first = -1;
  let last = -1;
  for (let y = 0; y < GRID_H; y++) {
    let lo = -1;
    let hi = -1;
    for (let x = 0; x < GRID_W; x++) {
      if (alpha(x, y) >= 0.5) {
        if (lo < 0) lo = x;
        hi = x;
      }
    }
    if (lo >= 0) {
      // Place each edge between pixels where the alpha crosses one half.
      const back = lo + 0.5 - (alpha(lo, y) - 0.5) / Math.max(alpha(lo, y) - alpha(lo - 1, y), 1e-3);
      const front = hi + 0.5 + (alpha(hi, y) - 0.5) / Math.max(alpha(hi, y) - alpha(hi + 1, y), 1e-3);
      rows[y] = { front: toZ(front), back: toZ(back) };
      if (first < 0) first = y;
      last = y;
    }
  }
  if (first < 0) return estimatedProfile;
  // Fill any empty rows inside from the row above, then smooth out the pixel steps.
  for (let y = first + 1; y <= last; y++) rows[y] ??= rows[y - 1];
  rows = rows.map((_, y) => {
    let front = 0;
    let back = 0;
    let n = 0;
    for (let k = Math.max(first, y - 6); k <= Math.min(last, y + 6); k++) {
      front += rows[k].front;
      back += rows[k].back;
      n++;
    }
    return { front: front / n, back: back / n };
  });

  const deepest = Math.max(...rows.slice(first, last + 1).map((r) => r.front - r.back));
  const scale = Math.min(DEPTH_SCALE, (MAX_DEPTH * frontWidth) / deepest);
  rows = rows.map((r) => r && { front: r.front * scale, back: r.back * scale });

  const shoulders = rows.slice(first, first + Math.max(1, Math.round((last - first) * 0.12)));
  const shift = shoulders.reduce((sum, r) => sum + (r.front + r.back) / 2, 0) / shoulders.length;
  const rowAt = (down: number) => first + down * (last - first);

  return {
    at(down) {
      const r = Math.max(first, Math.min(last, rowAt(down)));
      const a = rows[Math.floor(r)];
      const b = rows[Math.min(last, Math.floor(r) + 1)];
      const f = r - Math.floor(r);
      return { front: a.front + (b.front - a.front) * f - shift, back: a.back + (b.back - a.back) * f - shift };
    },
    uv: (_x, _y, z, down) => [(z + shift) / scale / PIC_W + 0.5, 1 - (rowAt(down) + 0.5) / GRID_H],
  };
}

// Pants hang from clips that press the waistband's front and back together, so the
// top is squeezed thin and opens out to full depth over the hips.
const WAIST_PINCH = 0.3;

function pinchWaist(profile: Profile): Profile {
  return {
    at(down) {
      const { front, back } = profile.at(down);
      const t = Math.min(down / 0.12, 1);
      const k = WAIST_PINCH + (1 - WAIST_PINCH) * t * t * (3 - 2 * t);
      const mid = (front + back) / 2;
      return { front: mid + (front - mid) * k, back: mid + (back - mid) * k };
    },
    uv: profile.uv,
  };
}

// Standard fabric, but the colour comes from the side picture wherever the surface
// faces sideways, fading over from the front (or back) picture as it turns.
function fabricMaterial(map: THREE.Texture, sideMap: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.sideMap = { value: sideMap };
    // three only applies a texture's crop (repeat and offset) to its own maps, so do it here.
    shader.uniforms.sideRepeat = { value: sideMap.repeat };
    shader.uniforms.sideOffset = { value: sideMap.offset };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 sideUv;\nvarying vec2 vSideUv;\nvarying float vSideways;",
      )
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvSideUv = sideUv;\nvSideways = abs(normal.x);");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D sideMap;\nuniform vec2 sideRepeat;\nuniform vec2 sideOffset;\nvarying vec2 vSideUv;\nvarying float vSideways;",
      )
      .replace(
        "#include <map_fragment>",
        // The pictures are drawn a few times smaller than they are, so lean towards the
        // sharper mipmaps (a negative bias); the default blur loses seams and ribbing.
        `#ifdef USE_MAP
          vec4 faceTexel = texture2D( map, vMapUv, -0.7 );
          vec4 sideTexel = texture2D( sideMap, vSideUv * sideRepeat + sideOffset, -0.7 );
          diffuseColor *= mix( faceTexel, sideTexel, smoothstep( 0.35, 0.8, vSideways ) );
        #endif`,
      );
  };
  return material;
}

function densify(ring: THREE.Vector2[], step: number) {
  const out: THREE.Vector2[] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const n = Math.max(1, Math.round(a.distanceTo(b) / step));
    for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
  });
  return out;
}

function traceOutline(picture: HTMLCanvasElement) {
  const grid = canvas(GRID_W, GRID_H);
  const ctx = grid.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(picture, 0, 0, GRID_W, GRID_H);
  const { data } = ctx.getImageData(0, 0, GRID_W, GRID_H);
  const alpha = new Float64Array(GRID_W * GRID_H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] / 255;

  const [outline] = contours().size([GRID_W, GRID_H]).thresholds([0.5])(Array.from(alpha));
  // Keep the biggest piece; anything else is a stray speck or a detached string.
  let ring: [number, number][] = [];
  let biggest = 0;
  for (const polygon of outline.coordinates) {
    const area = Math.abs(THREE.ShapeUtils.area(polygon[0].map(([x, y]) => new THREE.Vector2(x, y))));
    if (area > biggest) {
      biggest = area;
      ring = polygon[0] as [number, number][];
    }
  }
  if (ring.length < 3) {
    // No transparency to trace: use the whole frame.
    ring = [
      [0, 0],
      [GRID_W, 0],
      [GRID_W, GRID_H],
      [0, GRID_H],
    ];
  }

  const toWorld = ([x, y]: [number, number]) => new THREE.Vector2((x / GRID_W - 0.5) * PIC_W, -(y / GRID_H) * PIC_H);
  const points = simplifyRing(ring, 0.35).map(toWorld);
  const depth = distanceInside(alpha);
  // Distance from (x, y) in to the nearest edge, in world units; 0 or less outside.
  const inside = (x: number, y: number) => {
    if (!insidePolygon(points, x, y)) return 0;
    return Math.max(sampleGrid(depth, (x / PIC_W + 0.5) * GRID_W - 0.5, (-y / PIC_H) * GRID_H - 0.5), 1e-3);
  };

  // The lines EDGE_RINGS in from the outline, inside the piece that was kept.
  const rings: Ring[] = [];
  for (const level of contours().size([GRID_W, GRID_H]).thresholds(EDGE_RINGS)(Array.from(depth))) {
    for (const polygon of level.coordinates) {
      for (const line of polygon) {
        if (line.length < 4) continue;
        const ringPoints = simplifyRing(line as [number, number][], 0.25).map(toWorld);
        if (ringPoints.length >= 3 && insidePolygon(points, ringPoints[0].x, ringPoints[0].y)) {
          rings.push({ depth: level.value, points: ringPoints });
        }
      }
    }
  }
  return { points, top: Math.max(...points.map((p) => p.y)), inside, rings };
}

type Ring = { depth: number; points: THREE.Vector2[] };

// Two-pass chamfer distance transform over the alpha grid, in world units.
function distanceInside(alpha: Float64Array) {
  const cell = PIC_W / GRID_W;
  const d = new Float64Array(alpha.length);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H ? 0 : d[y * GRID_W + x]);
  for (let i = 0; i < d.length; i++) d[i] = alpha[i] >= 0.5 ? Infinity : 0;
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      const i = y * GRID_W + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
    }
  for (let y = GRID_H - 1; y >= 0; y--)
    for (let x = GRID_W - 1; x >= 0; x--) {
      const i = y * GRID_W + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
    }
  // Distances count from pixel centres; the true edge is half a pixel further out.
  for (let i = 0; i < d.length; i++) d[i] = d[i] === 0 ? 0 : (d[i] - 0.5) * cell;
  return d;
}

function sampleGrid(grid: Float64Array, gx: number, gy: number) {
  const x0 = Math.max(0, Math.min(GRID_W - 2, Math.floor(gx)));
  const y0 = Math.max(0, Math.min(GRID_H - 2, Math.floor(gy)));
  const fx = Math.max(0, Math.min(1, gx - x0));
  const fy = Math.max(0, Math.min(1, gy - y0));
  const v = (x: number, y: number) => grid[y * GRID_W + x];
  return (
    v(x0, y0) * (1 - fx) * (1 - fy) + v(x0 + 1, y0) * fx * (1 - fy) + v(x0, y0 + 1) * (1 - fx) * fy + v(x0 + 1, y0 + 1) * fx * fy
  );
}

function insidePolygon(points: THREE.Vector2[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

// The hanger has to stay hidden inside the piece, so its arms follow the outline:
// they reach most of the way to the shoulders and sit a little under the top edge
// all along their length (necklines dip, shoulders slope).
const HANGER_INSET = 0.12;

function fitHanger(points: THREE.Vector2[]) {
  const xs = points.map((p) => p.x);
  const reach = Math.min(0.8, Math.min(-Math.min(...xs), Math.max(...xs)) * 0.55);
  let centre = topEdgeAt(points, 0) - HANGER_INSET;
  let end = Math.min(topEdgeAt(points, -reach), topEdgeAt(points, reach)) - HANGER_INSET;

  // Drop the whole hanger by however far the straight arm pokes above the edge anywhere.
  let poke = 0;
  for (let i = 1; i < 20; i++) {
    const x = (reach * i) / 20;
    const y = centre + ((end - centre) * i) / 20;
    const room = Math.min(topEdgeAt(points, x), topEdgeAt(points, -x)) - HANGER_INSET;
    poke = Math.max(poke, y - room);
  }
  centre -= poke;
  end -= poke;
  return { kind: "arms" as const, reach, centre, end };
}

// Pants: one clip a little in from each end of the waistband, as deep as the waistband.
function fitClips(inside: (x: number, y: number) => number, top: number, profile: Profile, fallback: number) {
  const waist = bodyHalfWidth(inside, top - 0.1, fallback);
  const { front, back } = profile.at(0.02);
  return { kind: "clips" as const, x: Math.max(waist - 0.16, 0.15), front, back };
}

// Highest point of the outline straight above/below x.
function topEdgeAt(points: THREE.Vector2[], x: number) {
  let top = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a.x === b.x || (a.x - x) * (b.x - x) > 0) continue;
    top = Math.max(top, a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y));
  }
  return top;
}

// A traced ring starts and ends on the same point, which RDP can't measure from, so
// split it at the point farthest from the start and simplify each half.
function simplifyRing(ring: [number, number][], tolerance: number) {
  const [sx, sy] = ring[0];
  let far = 0;
  ring.forEach(([x, y], i) => {
    if (Math.hypot(x - sx, y - sy) > Math.hypot(ring[far][0] - sx, ring[far][1] - sy)) far = i;
  });
  return [...simplify(ring.slice(0, far + 1), tolerance).slice(0, -1), ...simplify(ring.slice(far), tolerance).slice(0, -1)];
}

// Ramer–Douglas–Peucker, to drop the staircase points marching squares leaves behind.
function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

// Textures are made at the photos' own size (the admin panel saves 1600×2000), so
// zooming in stays sharp, and cropped to the garment so no memory goes on empty space.
const FULL_W = 1600;
const FULL_H = 2000;
// Room left round the crop for the spread edge colours, in full-size pixels.
const CROP_MARGIN = 40;

// `framed` is the same picture drawn small (drawFramed), used to find the garment.
// The texture's repeat and offset map the frame's UVs onto the crop.
function garmentTexture(image: HTMLImageElement, framed: HTMLCanvasElement, mirror = false) {
  const box = opaqueBox(framed);
  const k = FULL_W / framed.width;
  const x0 = Math.max(0, Math.floor(box.x0 * k) - CROP_MARGIN);
  const y0 = Math.max(0, Math.floor(box.y0 * k) - CROP_MARGIN);
  const x1 = Math.min(FULL_W, Math.ceil(box.x1 * k) + CROP_MARGIN);
  const y1 = Math.min(FULL_H, Math.ceil(box.y1 * k) + CROP_MARGIN);
  const crop = canvas(x1 - x0, y1 - y0);
  const ctx = crop.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.min(FULL_W / image.naturalWidth, FULL_H / image.naturalHeight);
  const w = image.naturalWidth * scale;
  ctx.drawImage(image, (FULL_W - w) / 2 - x0, -y0, w, image.naturalHeight * scale);

  const texture = toTexture(bleed(crop, FULL_W / 48));
  // Frame UVs run 0 to 1 across the whole frame, v upward.
  texture.repeat.set(FULL_W / crop.width, FULL_H / crop.height);
  texture.offset.set(-x0 / crop.width, (y1 - FULL_H) / crop.height);
  if (mirror) {
    texture.offset.x += texture.repeat.x;
    texture.repeat.x *= -1;
  }
  return texture;
}

// Bounding box of the visible part of a picture, in its pixels.
function opaqueBox(picture: HTMLCanvasElement) {
  const { width: w, height: h } = picture;
  const { data } = picture.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
  let [x0, y0, x1, y1] = [w, h, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x + 1);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y + 1);
      }
    }
  }
  return x1 > x0 ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: w, y1: h };
}

// Paints edge colours outward into the transparent area and fills the rest with the
// garment's average colour, so the rolled edge and the small mipmaps never pick up
// see-through or black pixels. The spread is worked out at a quarter of the size,
// which is plenty for a blur and much quicker.
function bleed(picture: HTMLCanvasElement, spread: number) {
  const small = canvas(Math.ceil(picture.width / 4), Math.ceil(picture.height / 4));
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.filter = `blur(${Math.max(1, Math.round(spread / 4))}px)`;
  for (let i = 0; i < 4; i++) sctx.drawImage(picture, 0, 0, small.width, small.height);
  const image = sctx.getImageData(0, 0, small.width, small.height);
  const { data } = image;
  let [r, g, b, n] = [0, 0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 32) [r, g, b, n] = [r + data[i], g + data[i + 1], b + data[i + 2], n + 1];
  }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 8 && n) data.set([r / n, g / n, b / n], i);
    data[i + 3] = 255;
  }
  sctx.putImageData(image, 0, 0);

  const out = canvas(picture.width, picture.height);
  const ctx = out.getContext("2d")!;
  ctx.drawImage(small, 0, 0, out.width, out.height);
  ctx.drawImage(picture, 0, 0);
  return out;
}

function drawFramed(image: HTMLImageElement) {
  const out = canvas(TEX_W, TEX_H);
  const ctx = out.getContext("2d")!;
  const scale = Math.min(TEX_W / image.naturalWidth, TEX_H / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, (TEX_W - w) / 2, 0, w, h);
  return out;
}

function toTexture(source: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

async function loadImage(src: string) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Couldn't load garment picture ${src.slice(0, 80)}`));
    image.src = src;
  });
  return image;
}

function artUrl(product: Product, side: "front" | "back" | "side") {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement(GarmentArt, { product, side, hanger: false })));
  const markup = host.innerHTML;
  setTimeout(() => root.unmount());
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
