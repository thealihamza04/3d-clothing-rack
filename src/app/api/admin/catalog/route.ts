import { rm } from "node:fs/promises";
import { RACK_LIMIT, readCatalog, writeCatalog } from "@/lib/catalog";
import { photoDir } from "@/lib/photos";
import { GARMENT_TYPES, SIZES, type Product, type Size } from "@/lib/products";

// Edits data/catalog.json for the admin panel: add an item (POST), remove one
// (DELETE ?slug=), or change how many items the rack may hold (PATCH). It writes to
// this computer's disk, so it only runs in local development.

const notLocal = () =>
  process.env.NODE_ENV !== "development" &&
  new Response("The admin panel only works when running locally (pnpm dev).", { status: 403 });

const fail = (message: string, status = 400) => new Response(message, { status });

export async function POST(request: Request) {
  const blocked = notLocal();
  if (blocked) return blocked;

  const catalog = readCatalog();
  if (catalog.products.length >= catalog.settings.maxItems) {
    return fail(`The rack is full (${catalog.settings.maxItems} items). Raise the maximum or remove an item first.`);
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const price = Number(body?.price);
  const type = body?.type;
  const color = String(body?.color ?? "");
  if (!name) return fail("Give the item a name.");
  if (!Number.isFinite(price) || price <= 0) return fail("Price must be a number above 0.");
  if (!GARMENT_TYPES.some((g) => g.type === type)) return fail("Pick a garment type.");
  if (!/^#[0-9a-f]{6}$/i.test(color)) return fail("Colour must be a hex colour like #e0521d.");

  const stock = Object.fromEntries(
    SIZES.map((size) => [size, Math.max(0, Math.floor(Number(body?.stock?.[size]) || 0))]),
  ) as Record<Size, number>;

  const product: Product = {
    slug: uniqueSlug(name, catalog.products),
    name,
    colorName: String(body?.colorName ?? "").trim() || name.split(" ")[0],
    price: Math.round(price),
    type,
    color,
    accent: shade(color, -0.18),
    fabric: { kind: "solid" },
    stock,
    description: String(body?.description ?? "").trim(),
  };
  catalog.products.push(product);
  await writeCatalog(catalog);
  return Response.json(product);
}

export async function DELETE(request: Request) {
  const blocked = notLocal();
  if (blocked) return blocked;

  const slug = new URL(request.url).searchParams.get("slug");
  const catalog = readCatalog();
  if (!catalog.products.some((p) => p.slug === slug)) return fail(`Unknown item "${slug}".`);
  if (catalog.products.length <= catalog.settings.minItems) {
    return fail(`The rack needs at least ${catalog.settings.minItems} items. Lower the minimum first.`);
  }

  catalog.products = catalog.products.filter((p) => p.slug !== slug);
  await writeCatalog(catalog);
  // Its photos go too, so a new item with the same name starts clean.
  await rm(photoDir(slug!), { recursive: true, force: true });
  return Response.json({ removed: slug });
}

export async function PATCH(request: Request) {
  const blocked = notLocal();
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const minItems = Number(body?.minItems);
  const maxItems = Number(body?.maxItems);
  const catalog = readCatalog();
  const count = catalog.products.length;

  if (!Number.isInteger(minItems) || !Number.isInteger(maxItems)) return fail("Limits must be whole numbers.");
  if (minItems < 1) return fail("The minimum must be at least 1.");
  if (maxItems > RACK_LIMIT) return fail(`The maximum can't be more than ${RACK_LIMIT}.`);
  if (minItems > maxItems) return fail("The minimum can't be more than the maximum.");
  if (count > maxItems) return fail(`There are ${count} items on the rack; remove some before lowering the maximum to ${maxItems}.`);
  if (count < minItems) return fail(`There are only ${count} items on the rack; add some before raising the minimum to ${minItems}.`);

  catalog.settings = { minItems, maxItems };
  await writeCatalog(catalog);
  return Response.json(catalog.settings);
}

function uniqueSlug(name: string, products: Product[]) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item";
  let slug = base;
  for (let n = 2; products.some((p) => p.slug === slug); n++) slug = `${base}-${n}`;
  return slug;
}

// Lightens (amount > 0) or darkens (amount < 0) a hex colour.
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
