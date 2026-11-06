"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BRAND, type Photos, type Product } from "@/lib/products";
import { PhotosProvider } from "./photos-context";
import { ProductView } from "./product-view";
import { garmentBottom, useGarmentModels } from "./garment-3d";
import { LIFT, PIECE_Y, RackCanvas, SPREAD } from "./rack-canvas";
import { BagIcon, ChevronIcon, SearchIcon, UserIcon } from "./icons";

export function Store({ products, photos }: { products: Product[]; photos: Photos }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // Whether the opened piece was lifted on the rack, and whether the view has taken it yet.
  const [picked, setPicked] = useState(false);
  const [shown, setShown] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 639px)");

  // Rails of up to four on phones and ten elsewhere, split evenly.
  const perRail = isMobile ? 4 : 10;
  const rails = Math.max(1, Math.ceil(products.length / perRail));
  const perRow = Math.ceil(products.length / rails);
  const rows = Array.from({ length: rails }, (_, r) => products.slice(r * perRow, (r + 1) * perRow));

  return (
    <PhotosProvider value={photos}>
      <div className="relative flex min-h-dvh flex-col bg-[var(--paper)] text-neutral-900">
        <header className="grid grid-cols-3 items-start px-4 pt-5 sm:px-8 sm:pt-6">
          <div className="relative flex gap-5 pt-1">
            <button
              onClick={() => setAboutOpen((o) => !o)}
              className="text-[10px] tracking-[0.12em] text-neutral-600 uppercase hover:text-neutral-900"
            >
              About
            </button>
            {/* The admin panel saves to this computer, so it's only offered when running locally. */}
            {process.env.NODE_ENV === "development" && (
              <Link
                href="/admin"
                className="rounded-full border border-neutral-400 px-2 py-0.5 text-[9px] tracking-[0.12em] text-neutral-600 uppercase hover:border-neutral-900 hover:text-neutral-900"
              >
                Admin
              </Link>
            )}
            <AnimatePresence>
              {aboutOpen && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-8 left-0 z-30 w-64 rounded-xl border border-neutral-200 bg-white p-4 text-[11px] leading-relaxed shadow-lg"
                >
                  {BRAND} makes small runs of heavyweight basics and one-off statement pieces. When a size is gone,
                  it&apos;s gone.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="text-center font-logo text-xl font-bold tracking-[-0.01em] sm:text-2xl">{BRAND}</div>
          <div className="flex items-center justify-end gap-3 pt-5 text-neutral-700 sm:gap-4 sm:pt-7">
            <button className="hidden items-center gap-1.5 text-[10px] tracking-[0.08em] hover:text-neutral-900 sm:flex">
              <span className="inline-block h-2.5 w-4 rounded-[1px] bg-[linear-gradient(90deg,#fff_0_25%,#01411c_25%)] ring-1 ring-black/10" />
              PKR <ChevronIcon />
            </button>
            <button aria-label="Search" className="hover:text-neutral-900">
              <SearchIcon />
            </button>
            <button aria-label="Account" className="hidden hover:text-neutral-900 sm:block">
              <UserIcon />
            </button>
            <button aria-label={`Cart, ${cartCount} items`} className="relative hover:text-neutral-900">
              <BagIcon />
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-neutral-900 px-1 text-[9px] text-white"
                >
                  {cartCount}
                </motion.span>
              )}
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center gap-6 pt-[9vh] pb-10 sm:pt-[12vh]">
          {rows.map((row, r) => (
            <Rack
              key={r}
              items={row}
              offset={r * perRow}
              photos={photos}
              hovered={isMobile ? null : hovered}
              hidden={shown ? selected : null}
              // The rack holds still while a piece is open, so it can fly back to the same place.
              onHover={(i) => selected === null && setHovered(i)}
              onSelect={(i) => {
                setPicked(!isMobile && hovered === i);
                setShown(false);
                setSelected(i);
              }}
            />
          ))}
        </main>

        {/* The view animates its own open and close (the piece flies out of the rack and
            back), handing the piece over to and from the rack in the same spot. */}
        {selected !== null && (
          <ProductView
            products={products}
            index={selected}
            picked={picked}
            onIndexChange={setSelected}
            onShown={() => setShown(true)}
            onClosing={() => setHovered(null)}
            onLanded={() => setShown(false)}
            onClose={() => {
              setSelected(null);
              setShown(false);
            }}
            onAdd={() => setCartCount((c) => c + 1)}
          />
        )}
      </div>
    </PhotosProvider>
  );
}

// Pieces hang one slot (--s) apart. The 3D scene is drawn in slot units, and plain
// buttons over each slot handle pointing, clicking and keyboard focus.
const HEIGHT = 5.6; // rack height in slots, with room for a lifted piece and its tag

function Rack({
  items,
  offset,
  photos,
  hovered,
  hidden,
  onHover,
  onSelect,
}: {
  items: Product[];
  offset: number;
  photos: Photos;
  hovered: number | null;
  hidden: number | null;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
}) {
  const models = useGarmentModels(items, photos);
  const inRange = (i: number | null) => (i !== null && i >= offset && i < offset + items.length ? i - offset : null);
  const local = inRange(hovered);
  const label = local === null ? null : items[local];
  // The tag sits just under the lifted piece.
  const model = label && models[label.slug];
  const labelTop = model ? -(PIECE_Y + garmentBottom(model) * LIFT) + 0.3 : 4.6;

  return (
    <div
      className="relative [--s:clamp(44px,13.5vw,80px)] sm:[--s:clamp(60px,6.4vw,112px)]"
      style={{ width: `calc(var(--s) * ${items.length + 3})`, height: `calc(var(--s) * ${HEIGHT})` }}
      onMouseLeave={() => onHover(null)}
    >
      <RackCanvas items={items} models={models} hovered={local} hidden={inRange(hidden)} />

      {items.map((product, j) => (
        <button
          key={product.slug}
          aria-label={`${product.name}, ${product.colorName}`}
          data-slot={offset + j}
          className="absolute top-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
          style={{
            left: `calc(var(--s) * ${j + 1.5})`,
            width: "var(--s)",
            height: `calc(var(--s) * 4.2)`,
            translate: `calc(var(--s) * ${local === null || local === j ? 0 : Math.sign(j - local) * SPREAD}) 0`,
          }}
          onMouseEnter={() => onHover(offset + j)}
          onFocus={() => onHover(offset + j)}
          onClick={() => onSelect(offset + j)}
        />
      ))}

      {/* Name under the piece you're pointing at, like a shop tag. */}
      <div
        className="pointer-events-none absolute whitespace-nowrap"
        style={{ left: `calc(var(--s) * ${(local ?? 0) + 2})`, top: `calc(var(--s) * ${labelTop})`, translate: "-50% 0" }}
      >
        <AnimatePresence mode="wait">
          {label && (
            <motion.p
              key={label.slug}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              className="text-[10px] tracking-[0.06em] text-neutral-500 uppercase"
            >
              {label.name}
              <span className="ml-2 text-neutral-400">{label.colorName}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}
