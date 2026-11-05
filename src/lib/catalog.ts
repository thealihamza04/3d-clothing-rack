import "server-only";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog } from "./products";

const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");

// Hard limits on the rack, whatever the admin sets.
export const RACK_LIMIT = 24;

export function readCatalog(): Catalog {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
}

export async function writeCatalog(catalog: Catalog) {
  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
}
