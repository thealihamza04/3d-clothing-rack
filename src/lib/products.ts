// Temporary brand name: change it here and it updates everywhere.
export const BRAND = "RACK";

export const SIZES = ["S", "M", "L", "XL", "2XL"] as const;
export type Size = (typeof SIZES)[number];

export type GarmentType = "tee" | "longsleeve" | "hoodie" | "jacket" | "shirt" | "pants";

export type Fabric =
  | { kind: "solid" }
  | { kind: "stripe"; stripe: string }
  | { kind: "plaid"; lines: [string, string] };

export type Product = {
  slug: string;
  name: string;
  colorName: string;
  price: number;
  type: GarmentType;
  color: string;
  accent: string;
  fabric: Fabric;
  // Second colour used for a contrast panel on the front (shirts only).
  panel?: string;
  // Text printed across the back.
  backPrint?: string;
  stock: Record<Size, number>;
  description: string;
};

// The rack's contents live in data/catalog.json (read by src/lib/catalog.ts and
// edited from the admin panel).
export type Catalog = {
  settings: { minItems: number; maxItems: number };
  products: Product[];
};

export const GARMENT_TYPES: { type: GarmentType; label: string }[] = [
  { type: "tee", label: "T-shirt" },
  { type: "longsleeve", label: "Long sleeve" },
  { type: "hoodie", label: "Hoodie" },
  { type: "jacket", label: "Jacket" },
  { type: "shirt", label: "Shirt" },
  { type: "pants", label: "Pants" },
];

// Product photos the user dropped into public/products/<slug>/, found by src/lib/photos.ts.
export type PhotoSide = "front" | "back" | "side";
export type Photos = Record<string, Partial<Record<PhotoSide, string>>>;

export function formatPrice(amount: number) {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}
