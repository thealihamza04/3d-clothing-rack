"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Product } from "@/lib/products";
import { HungGarment, SlotCamera, StudioLights, useGarmentModels } from "./garment-3d";
import { usePhotos } from "./photos-context";
import { REST_TURN } from "./rack-canvas";

const WIDTH = 3.4;

// The single piece in the product view. It turns in from side-on when it appears,
// and a half-turn shows the back.
export function ShowcaseCanvas({ product, side }: { product: Product; side: "front" | "back" }) {
  const photos = usePhotos(product.slug);
  const models = useGarmentModels([product], { [product.slug]: photos });
  return (
    <div className="relative aspect-[3.4/4.7] w-[min(72vw,320px)] drop-shadow-[0_16px_18px_rgba(0,0,0,0.14)] sm:w-[min(30vw,340px)]">
      <Canvas flat dpr={[1, 2]} gl={{ alpha: true, antialias: true }} style={{ position: "absolute", inset: 0 }}>
        <SlotCamera width={WIDTH} centerX={0} top={0.15} />
        <StudioLights />
        <Turntable key={product.slug} side={side}>
          <HungGarment model={models[product.slug]} />
        </Turntable>
      </Canvas>
    </div>
  );
}

function Turntable({ side, children }: { side: "front" | "back"; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = side === "front" ? 0 : Math.PI;
    g.rotation.y += (target - g.rotation.y) * (1 - Math.exp(-dt * 6));
  });
  return (
    <group ref={ref} rotation={[0, REST_TURN, 0]}>
      {children}
    </group>
  );
}
