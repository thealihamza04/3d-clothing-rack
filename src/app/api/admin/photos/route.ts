import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { readCatalog } from "@/lib/catalog";
import { EXTENSIONS, VIEWS, photoDir } from "@/lib/photos";

const MAX_BYTES = 15 * 1024 * 1024;

// Saves product photos prepared by the admin panel into public/products/<slug>/.
// It writes to this computer's disk, so it only runs in local development.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("The admin panel only works when running locally (pnpm dev).", { status: 403 });
  }

  const form = await request.formData();
  const slug = String(form.get("slug") ?? "");
  if (!readCatalog().products.some((p) => p.slug === slug)) {
    return new Response(`Unknown product "${slug}".`, { status: 400 });
  }

  const dir = photoDir(slug);
  await mkdir(dir, { recursive: true });
  const saved: string[] = [];
  for (const view of VIEWS) {
    const file = form.get(view);
    if (!(file instanceof File)) continue;
    if (file.type !== "image/png" || file.size > MAX_BYTES) {
      return new Response(`The ${view} photo must be a PNG under 15 MB.`, { status: 400 });
    }
    // Drop any older copy in another format so only the new one is picked up.
    await Promise.all(EXTENSIONS.map((ext) => rm(path.join(dir, view + ext), { force: true })));
    await writeFile(path.join(dir, `${view}.png`), Buffer.from(await file.arrayBuffer()));
    saved.push(view);
  }

  if (saved.length === 0) return new Response("No photos sent.", { status: 400 });
  return Response.json({ saved });
}
