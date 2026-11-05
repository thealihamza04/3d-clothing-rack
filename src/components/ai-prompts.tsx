"use client";

import { useEffect, useRef, useState } from "react";

// One prompt for an image AI (Gemini, ChatGPT) that turns any photo of real clothes,
// worn, folded or on a hanger, into the front, back and side photos the rack needs.
const PROMPT = `Using the clothing item in the attached photo, create 3 separate product photos of it: one from the FRONT, one from the BACK and one from the SIDE. Make each one its own image, not a collage.

Keep it exactly the same item in all three: same colour, fabric, fit, length, collar, sleeves, pockets, prints, logos and every small detail. Don't add, remove or change anything. If it's being worn, folded, creased or shot at an angle, show it as it would look neatly laid out.

1. FRONT: straight-on front view, centred, whole garment in frame with a small margin. Long sleeves hang straight down at the sides.
2. BACK: seen from directly behind, same framing as the front. A hood lies flat down the back. If my photo shows the back, copy it exactly; if it doesn't, keep the back plain with no print.
3. SIDE: profile view, turned 90 degrees, with the front of the garment facing the RIGHT edge of the image. A hood falls at the back on the left. The near sleeve hangs straight down along the side.

All three: ghost-mannequin style, the garment keeps its natural shape with no person, no mannequin, no hanger and no hook in view. Plain seamless light grey (#e4e4e4) background, or medium grey (#8a8a8a) if the clothes are white or very pale. Soft even studio lighting, natural soft fabric folds, realistic fabric texture, sharp focus, no props, no extra text. Portrait 4:5. Same size, lighting and background in all three.`;

export function PromptTemplate() {
  const box = useRef<HTMLParagraphElement>(null);
  const [copied, setCopied] = useState<"yes" | "select" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied("yes");
    } catch {
      // No clipboard access: select the text so Ctrl+C works.
      if (box.current) window.getSelection()?.selectAllChildren(box.current);
      setCopied("select");
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-neutral-300 bg-white/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase">AI photo prompt</p>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-neutral-600">
            For any item: attach a photo of the clothes in Gemini or ChatGPT, paste this, and drop the three photos it
            makes into the item&apos;s Front, Back and Side boxes below. If it only makes one, reply &quot;now the
            back&quot;, then &quot;now the side&quot;.
          </p>
        </div>
        <button
          onClick={copy}
          className={`h-9 shrink-0 rounded-full px-5 text-[10px] tracking-[0.18em] uppercase transition-colors ${
            copied === "yes" ? "bg-emerald-600 text-white" : "bg-neutral-900 text-white hover:bg-neutral-700"
          }`}
        >
          {copied === "yes" ? "Copied ✓" : copied === "select" ? "Selected, press Ctrl+C" : "Copy prompt"}
        </button>
      </div>
      <p
        ref={box}
        data-prompt
        className="mt-4 max-h-56 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3 text-[12px] leading-relaxed whitespace-pre-line text-neutral-800 select-all"
      >
        {PROMPT}
      </p>
    </section>
  );
}
