"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Photos, Product } from "@/lib/products";
import { HungGarment, SlotCamera, StudioLights, steel, useGarmentModels } from "./garment-3d";
import type { GarmentModel } from "@/lib/garment-model";

// At rest a piece hangs side-on, turned just short of a quarter-turn so a sliver of
// the front shows, the way clothes look on a real rail.
export const REST_TURN = Math.PI / 2 - 0.1;
export const LIFT = 1.24;
// Rail centre, in slots below the top of the canvas.
const RAIL_Y = -0.2;

const railGeometry = new THREE.CylinderGeometry(0.028, 0.028, 1, 16).rotateZ(Math.PI / 2);
const capGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16).rotateZ(Math.PI / 2);

export function RackCanvas({
  items,
  photos,
  hovered,
  hidden,
}: {
  items: Product[];
  photos: Photos;
  hovered: number | null;
  hidden: number | null;
}) {
  const width = items.length + 3;
  const models = useGarmentModels(items, photos);
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      className="drop-shadow-[0_12px_12px_rgba(0,0,0,0.12)]"
    >
      <SlotCamera width={width} centerX={width / 2} top={0} />
      <StudioLights />

      <mesh geometry={railGeometry} material={steel} position={[width / 2, RAIL_Y, 0]} scale={[width - 0.12, 1, 1]} />
      <mesh geometry={capGeometry} material={steel} position={[0.06, RAIL_Y, 0]} />
      <mesh geometry={capGeometry} material={steel} position={[width - 0.06, RAIL_Y, 0]} />

      {items.map((product, i) => (
        <RackPiece
          key={product.slug}
          model={models[product.slug]}
          x={i + 2}
          hovered={hovered === i}
          shift={hovered === null || hovered === i ? 0 : Math.sign(i - hovered) * 0.8}
          hidden={hidden === i}
        />
      ))}
    </Canvas>
  );
}

function RackPiece({
  model,
  x,
  hovered,
  shift,
  hidden,
}: {
  model?: GarmentModel;
  x: number;
  hovered: boolean;
  shift: number;
  hidden: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const swing = useRef({ hovered: false, t: 0 });

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 7);
    g.rotation.y += ((hovered ? 0 : REST_TURN) - g.rotation.y) * k;
    g.position.x += (x + shift - g.position.x) * k;
    g.scale.setScalar(g.scale.x + ((hovered ? LIFT : 1) - g.scale.x) * k);

    // A small swing on the hook when the piece is picked up.
    if (hovered && !swing.current.hovered) swing.current.t = 0;
    swing.current.hovered = hovered;
    swing.current.t += dt;
    const t = swing.current.t;
    g.rotation.z = hovered ? 0.04 * Math.sin(t * 7) * Math.exp(-t * 2.4) : g.rotation.z * (1 - k);
  });

  return (
    <group ref={ref} position={[x, RAIL_Y + 0.03, 0]} rotation={[0, REST_TURN, 0]} visible={!hidden}>
      <HungGarment model={model} />
    </group>
  );
}
