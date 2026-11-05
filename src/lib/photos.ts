import "server-only";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { PhotoSide, Photos, Product } from "./products";

export const VIEWS: PhotoSide[] = ["front", "back", "side"];
export const EXTENSIONS = [".png", ".webp", ".jpg", ".jpeg"];

export const photoDir = (slug: string) => path.join(process.cwd(), "public", "products", slug);

// Looks for public/products/<slug>/front.png, back.png and side.png (webp/jpg also
// work). Each URL carries the file's modified time, so a replaced photo isn't
// served from the browser's cache.
export function findPhotos(products: Product[]): Photos {
  const photos: Photos = {};
  for (const { slug } of products) {
    const dir = photoDir(slug);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      const { name, ext } = path.parse(file);
      if (VIEWS.includes(name as PhotoSide) && EXTENSIONS.includes(ext.toLowerCase())) {
        const version = Math.round(statSync(path.join(dir, file)).mtimeMs);
        (photos[slug] ??= {})[name as PhotoSide] = `/products/${slug}/${file}?v=${version}`;
      }
    }
  }
  return photos;
}
