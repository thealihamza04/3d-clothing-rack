"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SIZES, formatPrice, type Product, type Size } from "@/lib/products";
import { ChevronIcon, CloseIcon } from "./icons";
import { ShowcaseCanvas } from "./showcase-canvas";

const spring = { type: "spring", stiffness: 260, damping: 26 } as const;

export function ProductView({
  products,
  index,
  onIndexChange,
  onClose,
  onAdd,
}: {
  products: Product[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const product = products[index];
  const [side, setSide] = useState<"front" | "back">("front");
  const [size, setSize] = useState<Size | null>(null);
  const [showStock, setShowStock] = useState(false);
  const [added, setAdded] = useState(false);

  const go = (step: number) => {
    onIndexChange((index + step + products.length) % products.length);
    setSide("front");
    setSize(null);
    setShowStock(false);
    setAdded(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-label={product.name}
      className="fixed inset-0 z-40 flex flex-col items-center overflow-y-auto px-4 py-12"
      initial={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(245,245,243,0)" }}
      animate={{ backdropFilter: "blur(16px)", backgroundColor: "rgba(245,245,243,0.6)" }}
      exit={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(245,245,243,0)" }}
      transition={{ duration: 0.35 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.button
        onClick={onClose}
        className="fixed top-5 right-5 flex items-center gap-1.5 text-[10px] tracking-[0.16em] uppercase hover:opacity-60 sm:right-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        Close <CloseIcon />
      </motion.button>

      {[-1, 1].map((step) => (
        <motion.button
          key={step}
          aria-label={step < 0 ? "Previous piece" : "Next piece"}
          onClick={() => go(step)}
          className={`fixed top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-neutral-400 bg-white/40 text-neutral-700 transition-colors hover:bg-neutral-900 hover:text-white ${
            step < 0 ? "left-3 sm:left-[8vw]" : "right-3 sm:right-[8vw]"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ChevronIcon dir={step < 0 ? "left" : "right"} />
        </motion.button>
      ))}

      {/* my-auto rather than justify-center, so the top stays reachable when the panel grows taller than the screen. */}
      <div className="my-auto flex w-full flex-col items-center">
      <ShowcaseCanvas product={product} side={side} />


      <motion.div
        key={product.slug}
        className="mt-4 flex w-full max-w-sm flex-col items-center text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.12 } }}
        exit={{ opacity: 0, y: 10, transition: { duration: 0.12 } }}
      >
        <h1 className="font-display text-lg leading-tight font-black tracking-[0.02em] uppercase sm:text-xl">
          {product.name}
        </h1>
        <p className="mt-1 text-[11px] tracking-[0.08em] text-neutral-600">{formatPrice(product.price)}</p>

        <div className="mt-4 flex rounded-full border border-neutral-900 p-0.5 text-[9px] tracking-[0.16em] uppercase">
          {(["front", "back"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className="relative h-6 w-16 rounded-full uppercase"
              aria-pressed={side === s}
            >
              {side === s && (
                <motion.span layoutId="side-pill" className="absolute inset-0 rounded-full bg-neutral-900" transition={spring} />
              )}
              <span className={`relative transition-colors ${side === s ? "text-white" : "text-neutral-700"}`}>{s}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-1.5">
          {SIZES.map((s) => {
            const soldOut = product.stock[s] === 0;
            return (
              <button
                key={s}
                disabled={soldOut}
                onClick={() => setSize(s)}
                className={`h-7 min-w-9 rounded-full border px-2 text-[10px] transition-colors ${
                  size === s
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : soldOut
                      ? "border-neutral-300 text-neutral-300 line-through"
                      : "border-neutral-400 text-neutral-800 hover:border-neutral-900"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        <button
          disabled={!size || added}
          onClick={() => {
            onAdd();
            setAdded(true);
          }}
          className={`mt-5 h-9 w-60 rounded-full text-[10px] tracking-[0.18em] uppercase transition-colors ${
            added
              ? "bg-emerald-600 text-white"
              : size
                ? "bg-neutral-900 text-white hover:bg-neutral-700"
                : "cursor-not-allowed bg-neutral-300/80 text-white"
          }`}
        >
          {added ? "Added to cart ✓" : size ? `Add to cart — ${size}` : "Select a size"}
        </button>

        <button
          onClick={() => setShowStock((v) => !v)}
          className="mt-2.5 text-[9px] tracking-[0.18em] uppercase underline underline-offset-4 hover:opacity-60"
        >
          See availability
        </button>

        <AnimatePresence initial={false}>
          {showStock && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-60 overflow-hidden"
            >
              <p className="pt-3 text-[11px] leading-relaxed text-neutral-600">{product.description}</p>
              <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 text-[10px] tracking-[0.1em] uppercase">
                {SIZES.map((s) => {
                  const n = product.stock[s];
                  return (
                    <li key={s} className="flex justify-between py-1.5">
                      <span>{s}</span>
                      <span className={n === 0 ? "text-neutral-400" : n <= 2 ? "text-amber-700" : "text-neutral-700"}>
                        {n === 0 ? "Sold out" : n <= 2 ? `Only ${n} left` : "In stock"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </div>
    </motion.div>
  );
}
