import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import { RACK_LIMIT, readCatalog } from "@/lib/catalog";
import { findPhotos } from "@/lib/photos";
import { BRAND } from "@/lib/products";

export const metadata: Metadata = { title: `Admin | ${BRAND}` };

// Saving writes into data/ and public/, so the panel only exists in local development.
export default function AdminPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const catalog = readCatalog();
  return <AdminPanel catalog={catalog} photos={findPhotos(catalog.products)} rackLimit={RACK_LIMIT} />;
}
