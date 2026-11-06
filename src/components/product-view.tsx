"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { SIZES, formatPrice, type Product, type Size } from "@/lib/products";
import { BagIcon, CheckIcon, ChevronIcon, CloseIcon } from "./icons";
import { FOV } from "./garment-3d";
import { LIFT, PIECE_Y, REST_TURN } from "./rack-canvas";
import { SHOWCASE_HEIGHT, SHOWCASE_TOP, SHOWCASE_WIDTH, ShowcaseCanvas } from "./showcase-canvas";

const spring = { type: "spring", stiffness: 260, damping: 26 } as const;
// The piece's trip between its hook on the rack and the middle of the view: it eases
// off, then settles.
const flight = { duration: 0.6, ease: [0.45, 0, 0.15, 1] } as const;
const blurred = { backdropFilter: "blur(16px)", backgroundColor: "rgba(245,245,243,0.6)" };
const clear = { backdropFilter: "blur(0px)", backgroundColor: "rgba(245,245,243,0)" };

export function ProductView({
  products,
  index,
  picked,
  onIndexChange,
  onShown,
  onClosing,
  onLanded,
  onClose,
  onAdd,
}: {
  products: Product[];
  index: number;
  /** The piece was lifted and facing front on the rack (hovered) when it was opened. */
  picked: boolean;
  onIndexChange: (i: number) => void;
  /** The view has taken the piece, so the rack can stop drawing it. */
  onShown: () => void;
  onClosing: () => void;
  /** The piece is back on its hook, so the rack can draw it again. */
  onLanded: () => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const product = products[index];
  const stage = useRef<HTMLDivElement>(null);
  // Where the piece hangs on the rack as the view opens; it flies out from there.
  const [entry] = useState(() => ({ slug: product.slug, pose: rackPose(index, picked) }));
  const arrivedRef = useRef(false);
  const [arrived, setArrived] = useState(false);
  const [leaving, setLeaving] = useState<number | null>(null); // the turn it's put back with
  const [side, setSide] = useState<"front" | "back">("front");
  const [size, setSize] = useState<Size | null>(null);
  const [showStock, setShowStock] = useState(false);
  const [added, setAdded] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);

  // The move and scale that put the view's hook on a rack hook. Measured from where the
  // stage is right now, so it also works mid-flight.
  const offsetTo = (pose: RackPose, stageBox: DOMRect) => {
    const unit = stageBox.width / scale.get() / SHOWCASE_WIDTH;
    return {
      x: pose.x - (stageBox.left + stageBox.width / 2 - x.get()),
      y: pose.y - (stageBox.top + (SHOWCASE_TOP / SHOWCASE_HEIGHT) * stageBox.height - y.get()),
      scale: (pose.slot * pose.lift) / unit,
    };
  };

  // Called once the piece has been drawn in the view: it takes over from the rack piece in
  // the same spot and pose, then flies to the middle. Until then the rack keeps showing it.
  const arrive = () => {
    if (arrivedRef.current || !stage.current) return;
    arrivedRef.current = true;
    setArrived(true);
    if (entry.pose) {
      const from = offsetTo(entry.pose, stage.current.getBoundingClientRect());
      x.jump(from.x);
      y.jump(from.y);
      scale.jump(from.scale);
      opacity.jump(1);
      animate(x, 0, flight);
      animate(y, 0, flight);
      animate(scale, 1, flight);
    } else {
      y.jump(16);
      animate(y, 0, flight);
      animate(opacity, 1, { duration: 0.3 });
    }
    onShown();
  };

  // If the model never loads, show the view anyway.
  const arriveLate = useEffectEvent(arrive);
  useEffect(() => {
    const t = setTimeout(arriveLate, 1500);
    return () => clearTimeout(t);
  }, []);

  // Closing flies the piece back onto its hook on the rack; the view goes once it lands.
  const close = () => {
    if (leaving !== null) return;
    if (!arrivedRef.current || !stage.current) return onClose();
    const pose = rackPose(index, false);
    onClosing();
    setLeaving(pose?.turn ?? REST_TURN);
    if (!pose) {
      animate(opacity, 0, { duration: 0.3 }).then(onClose);
      return;
    }
    const to = offsetTo(pose, stage.current.getBoundingClientRect());
    animate(x, to.x, flight);
    animate(y, to.y, flight);
    animate(scale, to.scale, flight).then(() => {
      // The rack draws the piece again first; this copy stays a few frames longer so
      // there's never a frame with neither.
      onLanded();
      afterFrames(3, onClose);
    });
  };

  const go = (step: number) => {
    if (leaving !== null || !arrived) return;
    onIndexChange((index + step + products.length) % products.length);
    setSide("front");
    setSize(null);
    setShowStock(false);
    setAdded(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The page behind stays put while the view is open, so there's only the view's own
  // scrollbar. The page's scrollbar width becomes padding, so nothing shifts sideways.
  useEffect(() => {
    const root = document.documentElement;
    const { overflow, paddingRight } = root.style;
    root.style.paddingRight = `${window.innerWidth - root.clientWidth}px`;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      root.style.paddingRight = paddingRight;
    };
  }, []);

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
      className="fixed inset-0 z-40 flex flex-col items-center overflow-y-auto overscroll-contain px-4 py-12"
      initial={clear}
      animate={leaving !== null ? clear : blurred}
      transition={leaving !== null ? flight : { duration: 0.45 }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <motion.button
        onClick={close}
        className="fixed top-5 right-5 flex items-center gap-1.5 text-[10px] tracking-[0.16em] uppercase hover:opacity-60 sm:right-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving !== null ? 0 : 1, transition: { duration: leaving !== null ? 0.15 : 0.3 } }}
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
          animate={{ opacity: leaving !== null ? 0 : 1, transition: { duration: leaving !== null ? 0.15 : 0.3 } }}
        >
          <ChevronIcon dir={step < 0 ? "left" : "right"} />
        </motion.button>
      ))}

      {/* my-auto rather than justify-center, so the top stays reachable when the panel grows taller than the screen. */}
      <div className="my-auto flex w-full flex-col items-center">
      <motion.div
        ref={stage}
        style={{ x, y, scale, opacity, transformOrigin: `50% ${(SHOWCASE_TOP / SHOWCASE_HEIGHT) * 100}%` }}
      >
        <ShowcaseCanvas
          product={product}
          startTurn={product.slug === entry.slug && entry.pose ? entry.pose.turn : REST_TURN}
          turn={leaving ?? (side === "front" ? 0 : Math.PI)}
          pace={!arrived ? 0 : leaving !== null ? 9 : 6}
          onReady={arrive}
        />
      </motion.div>

      <motion.div
        key={product.slug}
        className="mt-4 flex w-full max-w-sm flex-col items-center text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={
          leaving !== null
            ? { opacity: 0, y: 10, transition: { duration: 0.15 } }
            : { opacity: 1, y: 0, transition: { delay: 0.4 } }
        }
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
          className={`mt-5 flex h-9 w-60 items-center justify-center gap-2 rounded-full text-[10px] tracking-[0.18em] uppercase transition-colors ${
            added
              ? "bg-emerald-600 text-white"
              : size
                ? "bg-neutral-900 text-white hover:bg-neutral-700"
                : "cursor-not-allowed bg-neutral-300/80 text-white"
          }`}
        >
          {added ? (
            <>
              <CheckIcon size={13} /> Added to cart
            </>
          ) : size ? (
            <>
              <BagIcon size={13} /> Add to cart
              <span className="rounded-full bg-white/15 px-2 py-0.5 tracking-[0.1em]">{size}</span>
            </>
          ) : (
            "Select a size"
          )}
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

function afterFrames(n: number, fn: () => void) {
  requestAnimationFrame(() => (n > 1 ? afterFrames(n - 1, fn) : fn()));
}

type RackPose = { x: number; y: number; slot: number; lift: number; turn: number };

// Where piece `index` hangs on the rack: its hook on screen, the slot size in px, its
// scale and its turn. The rack's camera sees pieces away from its centre a little from
// the side, so the turn includes that angle.
function rackPose(index: number, picked: boolean): RackPose | null {
  const slot = document.querySelector<HTMLElement>(`[data-slot="${index}"]`);
  const rack = slot?.offsetParent;
  if (!slot || !(rack instanceof HTMLElement)) return null;
  const s = slot.offsetWidth;
  const hookX = slot.offsetLeft + s / 2;
  const box = rack.getBoundingClientRect();
  const cameraDistance = rack.offsetHeight / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
  return {
    x: box.left + hookX,
    y: box.top - PIECE_Y * s,
    slot: s,
    lift: picked ? LIFT : 1,
    turn: (picked ? 0 : REST_TURN) + Math.atan((hookX - rack.offsetWidth / 2) / cameraDistance),
  };
}
