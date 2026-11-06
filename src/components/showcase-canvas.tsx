"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Product } from "@/lib/products";
import { HungGarment, SlotCamera, StudioLights, useGarmentModels } from "./garment-3d";
import { usePhotos } from "./photos-context";

// The scene is SHOWCASE_WIDTH by SHOWCASE_HEIGHT units (the aspect class below), and the
// hook sits SHOWCASE_TOP units under the top edge, centred.
export const SHOWCASE_WIDTH = 3.4;
export const SHOWCASE_HEIGHT = 4.7;
export const SHOWCASE_TOP = 0.15;

// The single piece in the product view. It starts at `startTurn` and turns towards
// `turn` at `pace` (0 holds it still). `onReady` fires once the garment has been drawn.
export function ShowcaseCanvas({
  product,
  startTurn,
  turn,
  pace,
  onReady,
}: {
  product: Product;
  startTurn: number;
  turn: number;
  pace: number;
  onReady?: () => void;
}) {
  const photos = usePhotos(product.slug);
  const models = useGarmentModels([product], { [product.slug]: photos });
  const model = models[product.slug];
  return (
    <div className="relative aspect-[3.4/4.7] w-[min(72vw,320px)] drop-shadow-[0_16px_18px_rgba(0,0,0,0.14)] sm:w-[min(30vw,340px)]">
      <Canvas flat dpr={[1, 2]} gl={{ alpha: true, antialias: true }} style={{ position: "absolute", inset: 0 }}>
        <SlotCamera width={SHOWCASE_WIDTH} centerX={0} top={SHOWCASE_TOP} />
        <StudioLights />
        <Turntable key={product.slug} start={startTurn} turn={turn} pace={pace} loaded={!!model} onReady={onReady}>
          <HungGarment model={model} />
        </Turntable>
      </Canvas>
    </div>
  );
}

function Turntable({
  start,
  turn,
  pace,
  loaded,
  onReady,
  children,
}: {
  start: number;
  turn: number;
  pace: number;
  loaded: boolean;
  onReady?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const drawn = useRef(0); // frames drawn since the garment loaded
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.y += (turn - g.rotation.y) * (1 - Math.exp(-dt * pace));
    // This runs before the frame is drawn, so the garment is on screen one frame later.
    if (loaded && drawn.current++ === 1) onReady?.();
  });
  return (
    <group ref={ref} rotation={[0, start, 0]}>
      {children}
    </group>
  );
}
