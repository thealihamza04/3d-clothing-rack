// Prepares product photos in the browser for the admin panel: cuts the garment out
// of a plain studio background and frames it the way the 3D rack expects, on a
// 1600×2000 (4:5) transparent canvas, centred, with its top at the top edge.
//
// Sizing: a front is scaled to a standard width so every product hangs at the same
// size; a back or side is scaled to the same height as that product's front.

import type { PhotoSide } from "./products";

const CANVAS_W = 1600;
const CANVAS_H = 2000;
// Front width as a share of the canvas, matching the drawn placeholders.
const FRONT_WIDTH = 0.74;

// Reads an image file, removes its backdrop (unless it's already transparent) and
// crops to the garment. Side photos can be mirrored so the front faces right.
export async function cutOutGarment(file: Blob, mirror = false) {
  const bitmap = await createImageBitmap(file);
  const source = canvas(bitmap.width, bitmap.height);
  const ctx = source.getContext("2d", { willReadFrequently: true })!;
  if (mirror) {
    ctx.translate(bitmap.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const image = ctx.getImageData(0, 0, source.width, source.height);
  if (!hasTransparency(image)) removeBackdrop(image);
  ctx.putImageData(image, 0, 0);

  const box = boundingBox(image);
  if (!box) throw new Error("Couldn't find a garment in that photo.");
  const garment = canvas(box.width, box.height);
  garment.getContext("2d")!.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  return garment;
}

// How tall a front ends up once framed, which a back or side is matched to.
export function framedFrontHeight(front: HTMLCanvasElement) {
  return front.height * frontScale(front);
}

// Puts a cut-out garment on the standard canvas. `frontHeight` is the framed height
// of the same product's front, if there is one.
export function frameGarment(garment: HTMLCanvasElement, view: PhotoSide, frontHeight: number | null) {
  const scale = view !== "front" && frontHeight ? frontHeight / garment.height : frontScale(garment);
  const width = Math.round(garment.width * scale);
  const height = Math.round(garment.height * scale);
  const out = canvas(CANVAS_W, CANVAS_H);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(garment, Math.round((CANVAS_W - width) / 2), 0, width, height);
  return out;
}

// Height of the garment in an already framed photo (e.g. a saved front).
export async function measureFramedHeight(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const c = canvas(bitmap.width, bitmap.height);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const box = boundingBox(ctx.getImageData(0, 0, c.width, c.height));
  // Saved photos are on the standard canvas, but measure in its units just in case.
  return box ? (box.height * CANVAS_H) / c.height : null;
}

export function toPng(c: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the image."))), "image/png"),
  );
}

function frontScale(garment: HTMLCanvasElement) {
  return Math.min((FRONT_WIDTH * CANVAS_W) / garment.width, (0.98 * CANVAS_H) / garment.height);
}

function hasTransparency({ data }: ImageData) {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

// Floods in from the edges over the backdrop. A pixel counts as backdrop if it's
// close to the backdrop's colour or is a neutral grey a little darker (the soft
// shadow under the garment), and the area around it is smooth, since fabric always
// has some texture. The flood also only steps between near-identical neighbours, so
// it stops at the garment's edge even when the garment is grey on grey. Whatever it
// can't reach, like drawcords or a white logo inside the garment, is kept.
const NEAR_BACKDROP = 30; // colour distance
const SHADOW_DEPTH = 45; // how much darker than the backdrop a shadow can be
const SMOOTH = 4; // max brightness spread (std dev) around a backdrop pixel
const STEP = 7; // max channel difference between neighbouring backdrop pixels

function removeBackdrop(image: ImageData) {
  const { data, width: w, height: h } = image;
  const n = w * h;

  const border: [number[], number[], number[]] = [[], [], []];
  const sample = (i: number) => border.forEach((channel, c) => channel.push(data[i * 4 + c]));
  for (let x = 0; x < w; x++) {
    sample(x);
    sample((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    sample(y * w);
    sample(y * w + w - 1);
  }
  const backdrop = border.map((channel) => channel.sort((a, b) => a - b)[channel.length >> 1]);
  const shade = (backdrop[0] + backdrop[1] + backdrop[2]) / 3;

  const brightness = new Float32Array(n);
  const near = new Uint8Array(n);
  const like = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    brightness[i] = (r + g + b) / 3;
    near[i] = Math.hypot(r - backdrop[0], g - backdrop[1], b - backdrop[2]) < NEAR_BACKDROP ? 1 : 0;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const shadow = chroma < 12 && brightness[i] >= shade - SHADOW_DEPTH && brightness[i] <= shade + 15;
    like[i] = near[i] || shadow ? 1 : 0;
  }
  const spread = localSpread(brightness, w, h);
  for (let i = 0; i < n; i++) if (spread[i] >= SMOOTH) like[i] = 0;

  const background = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const seed = (i: number) => {
    if (like[i] && !background[i]) {
      background[i] = 1;
      stack[top++] = i;
    }
  };
  const step = (from: number, to: number) => {
    if (!like[to] || background[to]) return;
    const a = from * 4;
    const b = to * 4;
    if (Math.max(Math.abs(data[a] - data[b]), Math.abs(data[a + 1] - data[b + 1]), Math.abs(data[a + 2] - data[b + 2])) > STEP)
      return;
    background[to] = 1;
    stack[top++] = to;
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (top) {
    const i = stack[--top];
    const x = i % w;
    if (x > 0) step(i, i - 1);
    if (x < w - 1) step(i, i + 1);
    if (i >= w) step(i, i - w);
    if (i < n - w) step(i, i + w);
  }

  // The smoothness test can't see right up to the edge, which leaves a thin halo of
  // backdrop round the garment. Peel it: a few rounds of taking backdrop-coloured
  // pixels that touch the background.
  for (let round = 0; round < 3; round++) {
    const grown: number[] = [];
    for (let i = 0; i < n; i++) {
      if (background[i] || !near[i]) continue;
      const x = i % w;
      if ((x > 0 && background[i - 1]) || (x < w - 1 && background[i + 1]) || (i >= w && background[i - w]) || (i < n - w && background[i + w]))
        grown.push(i);
    }
    for (const i of grown) background[i] = 1;
  }

  // Pull the edge in a pixel (it's usually tinted by the backdrop), then soften it.
  let alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w;
    const solid =
      !background[i] &&
      (x === 0 || !background[i - 1]) &&
      (x === w - 1 || !background[i + 1]) &&
      (i < w || !background[i - w]) &&
      (i >= n - w || !background[i + w]);
    alpha[i] = solid ? 255 : 0;
  }
  for (let pass = 0; pass < 2; pass++) alpha = boxBlur(alpha, w, h);
  for (let i = 0; i < n; i++) data[i * 4 + 3] = alpha[i];
}

// Standard deviation of each pixel's 5×5 neighbourhood, using summed-area tables.
function localSpread(values: Float32Array, w: number, h: number) {
  const sum = new Float64Array((w + 1) * (h + 1));
  const sq = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    let rowSq = 0;
    for (let x = 0; x < w; x++) {
      const v = values[y * w + x];
      rowSum += v;
      rowSq += v * v;
      const i = (y + 1) * (w + 1) + x + 1;
      sum[i] = sum[i - w - 1] + rowSum;
      sq[i] = sq[i - w - 1] + rowSq;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 2);
    const y1 = Math.min(h, y + 3);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 2);
      const x1 = Math.min(w, x + 3);
      const area = (y1 - y0) * (x1 - x0);
      const box = (t: Float64Array) =>
        t[y1 * (w + 1) + x1] - t[y0 * (w + 1) + x1] - t[y1 * (w + 1) + x0] + t[y0 * (w + 1) + x0];
      const mean = box(sum) / area;
      out[y * w + x] = Math.sqrt(Math.max(box(sq) / area - mean * mean, 0));
    }
  }
  return out;
}

function boxBlur(src: Float32Array, w: number, h: number) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          sum += src[yy * w + xx];
          count++;
        }
      }
      out[y * w + x] = sum / count;
    }
  }
  return out;
}

function boundingBox({ data, width: w, height: h }: ImageData) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}
