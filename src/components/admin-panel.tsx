"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BRAND,
  GARMENT_TYPES,
  SIZES,
  formatPrice,
  type Catalog,
  type PhotoSide,
  type Photos,
  type Product,
  type Size,
} from "@/lib/products";
import { cutOutGarment, frameGarment, framedFrontHeight, measureFramedHeight, toPng } from "@/lib/photo-prep";
import { PromptTemplate } from "./ai-prompts";

const SLOTS: { view: PhotoSide; label: string; hint: string }[] = [
  { view: "front", label: "Front", hint: "Facing the camera" },
  { view: "back", label: "Back", hint: "Same framing as the front" },
  { view: "side", label: "Side", hint: "Optional · front facing right" },
];

type Pending = { file: File; garment: HTMLCanvasElement; preview: string; mirrored: boolean };

const label = "text-[10px] font-semibold tracking-[0.14em] uppercase";
const field =
  "h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-neutral-900";
const primary =
  "h-9 rounded-full bg-neutral-900 px-5 text-[10px] tracking-[0.18em] text-white uppercase transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300";

export function AdminPanel({ catalog, photos, rackLimit }: { catalog: Catalog; photos: Photos; rackLimit: number }) {
  const { products, settings } = catalog;
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const full = products.length >= settings.maxItems;
  const atMinimum = products.length <= settings.minItems;

  return (
    <div className="min-h-dvh bg-[var(--paper)] text-neutral-900">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="text-[10px] tracking-[0.12em] text-neutral-600 uppercase hover:text-neutral-900">
          ← Store
        </Link>
        <div className="font-logo text-xl font-bold">{BRAND}</div>
        <span className="text-[10px] tracking-[0.12em] text-neutral-600 uppercase">Admin</span>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-8">
        <section className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h1 className="font-display text-2xl font-black tracking-[0.01em] uppercase">The rack</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
              Add or remove items, set how many the rack holds, and give each item its photos. Changes are saved
              to <code className="rounded bg-neutral-200/70 px-1 text-[12px]">data/catalog.json</code> and{" "}
              <code className="rounded bg-neutral-200/70 px-1 text-[12px]">public/products</code> on this computer.
            </p>
          </div>
          <RackLimits key={`${settings.minItems}-${settings.maxItems}`} settings={settings} count={products.length} rackLimit={rackLimit} />
        </section>

        <PromptTemplate />

        <div className="mt-10 mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={label}>
            On the rack · {products.length} of {settings.maxItems}
          </h2>
          <div className="flex items-center gap-3">
            {full && !adding && <span className="text-[11px] text-neutral-500">Rack is full. Raise the maximum to add more.</span>}
            <button
              onClick={() => {
                setAdding((a) => !a);
                setNotice("");
              }}
              disabled={full && !adding}
              className={adding ? "h-9 rounded-full border border-neutral-400 px-5 text-[10px] tracking-[0.18em] uppercase hover:border-neutral-900" : primary}
            >
              {adding ? "Cancel" : "+ Add item"}
            </button>
          </div>
        </div>

        {adding && (
          <AddItemForm
            onAdded={(product) => {
              setAdding(false);
              setNotice(`${product.name} is on the rack. Drop its photos below.`);
            }}
          />
        )}
        {notice && (
          <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800" role="status">
            {notice}
          </p>
        )}

        <ul className="divide-y divide-neutral-300/70 border-y border-neutral-300/70">
          {products.map((product) => (
            <ProductPhotos
              key={product.slug}
              product={product}
              saved={photos[product.slug] ?? {}}
              canRemove={!atMinimum}
              minItems={settings.minItems}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}

function RackLimits({
  settings,
  count,
  rackLimit,
}: {
  settings: Catalog["settings"];
  count: number;
  rackLimit: number;
}) {
  const router = useRouter();
  const [minItems, setMinItems] = useState(String(settings.minItems));
  const [maxItems, setMaxItems] = useState(String(settings.maxItems));
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "error"; message?: string }>({ kind: "idle" });
  const changed = Number(minItems) !== settings.minItems || Number(maxItems) !== settings.maxItems;

  async function save() {
    setStatus({ kind: "saving" });
    const response = await fetch("/api/admin/catalog", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minItems: Number(minItems), maxItems: Number(maxItems) }),
    });
    if (!response.ok) return setStatus({ kind: "error", message: await response.text() });
    setStatus({ kind: "idle" });
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-neutral-300 bg-white/60 p-4">
      <p className={label}>Rack size</p>
      <div className="mt-3 flex items-end gap-3">
        <label className="w-20">
          <span className="text-[11px] text-neutral-500">Minimum</span>
          <input type="number" min={1} max={rackLimit} value={minItems} onChange={(e) => setMinItems(e.target.value)} className={field} />
        </label>
        <label className="w-20">
          <span className="text-[11px] text-neutral-500">Maximum</span>
          <input type="number" min={1} max={rackLimit} value={maxItems} onChange={(e) => setMaxItems(e.target.value)} className={field} />
        </label>
        <button onClick={save} disabled={!changed || status.kind === "saving"} className={primary}>
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
      <p className={`mt-2 max-w-72 text-[11px] ${status.kind === "error" ? "text-red-700" : "text-neutral-500"}`} role="status">
        {status.kind === "error" ? status.message : `${count} items now. Up to ${rackLimit} fit on the rack.`}
      </p>
    </div>
  );
}

function AddItemForm({ onAdded }: { onAdded: (product: Product) => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(form: FormData) {
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        price: form.get("price"),
        colorName: form.get("colorName"),
        type: form.get("type"),
        color: form.get("color"),
        description: form.get("description"),
        stock: Object.fromEntries(SIZES.map((size) => [size, form.get(`stock-${size}`)])),
      }),
    });
    setSaving(false);
    if (!response.ok) return setError(await response.text());
    onAdded(await response.json());
    router.refresh();
  }

  return (
    <form action={submit} className="mb-6 grid gap-4 rounded-xl border border-neutral-300 bg-white/70 p-5 md:grid-cols-6">
      <label className="md:col-span-3">
        <span className="text-[11px] text-neutral-500">Name</span>
        <input name="name" required placeholder="Lemon Heavy Tee" className={field} />
      </label>
      <label className="md:col-span-1">
        <span className="text-[11px] text-neutral-500">Price (Rs)</span>
        <input name="price" type="number" min={1} required placeholder="4900" className={field} />
      </label>
      <label className="md:col-span-2">
        <span className="text-[11px] text-neutral-500">Colour name</span>
        <input name="colorName" placeholder="Lemon" className={field} />
      </label>
      <label className="md:col-span-2">
        <span className="text-[11px] text-neutral-500">Type</span>
        <select name="type" defaultValue="tee" className={field}>
          {GARMENT_TYPES.map((g) => (
            <option key={g.type} value={g.type}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="md:col-span-1">
        <span className="text-[11px] text-neutral-500">Colour</span>
        <input name="color" type="color" defaultValue="#e8d21d" className={`${field} p-1`} title="Used for the drawing until photos are added" />
      </label>
      <fieldset className="md:col-span-3">
        <legend className="text-[11px] text-neutral-500">Stock per size</legend>
        <div className="grid grid-cols-5 gap-2">
          {SIZES.map((size: Size) => (
            <label key={size} className="text-center">
              <input name={`stock-${size}`} type="number" min={0} defaultValue={5} aria-label={`${size} stock`} className={`${field} px-1 text-center`} />
              <span className="text-[10px] text-neutral-500">{size}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="md:col-span-6">
        <span className="text-[11px] text-neutral-500">Description</span>
        <textarea name="description" rows={2} placeholder="Heavyweight cotton, boxy fit." className={`${field} h-auto py-2`} />
      </label>
      <div className="flex items-center gap-4 md:col-span-6">
        <button type="submit" disabled={saving} className={primary}>
          {saving ? "Adding…" : "Add to rack"}
        </button>
        {error && (
          <p className="text-[12px] text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function ProductPhotos({
  product,
  saved,
  canRemove,
  minItems,
}: {
  product: Product;
  saved: Partial<Record<PhotoSide, string>>;
  canRemove: boolean;
  minItems: number;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);
  const [pending, setPending] = useState<Partial<Record<PhotoSide, Pending>>>({});
  const [working, setWorking] = useState<PhotoSide | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({
    kind: "idle",
  });
  const hasChanges = Object.keys(pending).length > 0;

  async function prepare(view: PhotoSide, file: File, mirrored = false) {
    setWorking(view);
    setStatus({ kind: "idle" });
    try {
      const garment = await cutOutGarment(file, mirrored);
      setPending((p) => ({ ...p, [view]: { file, garment, preview: garment.toDataURL(), mirrored } }));
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Couldn't read that image." });
    } finally {
      setWorking(null);
    }
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      // Backs and sides are sized to match the front, new or already saved.
      const frontHeight = pending.front
        ? framedFrontHeight(pending.front.garment)
        : saved.front
          ? await measureFramedHeight(saved.front)
          : null;
      const form = new FormData();
      form.set("slug", product.slug);
      for (const { view } of SLOTS) {
        const item = pending[view];
        if (item) form.set(view, await toPng(frameGarment(item.garment, view, frontHeight)), `${view}.png`);
      }
      const response = await fetch("/api/admin/photos", { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      setPending({});
      setStatus({ kind: "saved" });
      router.refresh();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Saving failed." });
    }
  }

  async function remove() {
    if (!window.confirm(`Remove "${product.name}" from the rack? Its photos will be deleted too.`)) return;
    setRemoving(true);
    const response = await fetch(`/api/admin/catalog?slug=${encodeURIComponent(product.slug)}`, { method: "DELETE" });
    if (!response.ok) {
      setRemoving(false);
      return setStatus({ kind: "error", message: await response.text() });
    }
    router.refresh();
  }

  return (
    <li className={`grid gap-5 py-6 md:grid-cols-[200px_1fr_auto] md:items-start ${removing ? "opacity-40" : ""}`}>
      <div>
        <p className="text-sm font-semibold">{product.name}</p>
        <p className="mt-0.5 text-[11px] text-neutral-500">{product.slug}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-600">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: product.color }} />
          {GARMENT_TYPES.find((g) => g.type === product.type)?.label} · {formatPrice(product.price)}
        </p>
        <button
          onClick={remove}
          disabled={!canRemove || removing}
          title={canRemove ? undefined : `The rack needs at least ${minItems} items.`}
          className="mt-3 text-[11px] text-red-700 underline underline-offset-2 hover:text-red-900 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
        >
          {removing ? "Removing…" : "Remove from rack"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {SLOTS.map((slot) => (
          <PhotoSlot
            key={slot.view}
            {...slot}
            saved={saved[slot.view]}
            pending={pending[slot.view]}
            working={working === slot.view}
            onFile={(file) => prepare(slot.view, file)}
            onMirror={() => {
              const item = pending[slot.view];
              if (item) prepare(slot.view, item.file, !item.mirrored);
            }}
            onDiscard={() =>
              setPending((p) => {
                const next = { ...p };
                delete next[slot.view];
                return next;
              })
            }
          />
        ))}
      </div>

      <div className="flex flex-col items-start gap-2 md:items-end">
        <button
          onClick={save}
          disabled={!hasChanges || status.kind === "saving" || working !== null}
          className="h-9 w-28 rounded-full bg-neutral-900 text-[10px] tracking-[0.18em] text-white uppercase transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
        <p
          className={`min-h-4 max-w-56 text-[11px] md:text-right ${status.kind === "error" ? "text-red-700" : "text-neutral-500"}`}
          role="status"
        >
          {status.kind === "saved" && "Saved. It's on the rack now."}
          {status.kind === "error" && status.message}
          {status.kind === "idle" && hasChanges && "Unsaved changes"}
        </p>
      </div>
    </li>
  );
}

function PhotoSlot({
  view,
  label,
  hint,
  saved,
  pending,
  working,
  onFile,
  onMirror,
  onDiscard,
}: {
  view: PhotoSide;
  label: string;
  hint: string;
  saved?: string;
  pending?: Pending;
  working: boolean;
  onFile: (file: File) => void;
  onMirror: () => void;
  onDiscard: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const shown = pending?.preview ?? saved;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase">{label}</span>
        {pending ? (
          <span className="text-[9px] tracking-[0.12em] text-amber-700 uppercase">New</span>
        ) : saved ? (
          <span className="text-[9px] tracking-[0.12em] text-emerald-700 uppercase">Saved</span>
        ) : null}
      </div>

      <button
        type="button"
        aria-label={`${label} photo: drop an image or click to choose one`}
        data-drop={view}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file?.type.startsWith("image/")) onFile(file);
        }}
        className={`relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-lg border transition-colors ${
          over
            ? "border-neutral-900 bg-white"
            : shown
              ? "border-neutral-300 bg-[conic-gradient(#e7e7e4_25%,#f7f7f5_0_50%,#e7e7e4_0_75%,#f7f7f5_0)] bg-[length:14px_14px]"
              : "border-dashed border-neutral-400 bg-white/50 hover:border-neutral-900"
        }`}
      >
        {shown && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="absolute inset-0 h-full w-full object-contain p-2" draggable={false} />
        )}
        {!shown && !working && (
          <span className="px-2 text-center text-[11px] leading-snug text-neutral-500">
            Drop image
            <br />
            or click
          </span>
        )}
        {working && (
          <span className="absolute inset-0 grid place-items-center bg-white/70 text-[11px] text-neutral-600">
            Cutting out…
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      <div className="mt-1.5 flex min-h-4 flex-wrap gap-x-3 text-[10px] text-neutral-500">
        {pending ? (
          <>
            {view === "side" && (
              <button onClick={onMirror} className="underline underline-offset-2 hover:text-neutral-900">
                Mirror
              </button>
            )}
            <button onClick={onDiscard} className="underline underline-offset-2 hover:text-neutral-900">
              Discard
            </button>
          </>
        ) : (
          <span>{hint}</span>
        )}
      </div>
    </div>
  );
}
