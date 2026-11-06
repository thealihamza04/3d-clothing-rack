"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Product } from "@/lib/products";
import { HungGarment, SlotCamera, StudioLights, steel } from "./garment-3d";
import type { GarmentModel } from "@/lib/garment-model";

// At rest a piece hangs at about three-quarters, turned ~73° so part of its front
// shows, the way clothes look on a real rail. Pointing at one turns it to face you,
// lifts it a little and moves its neighbours SPREAD slots aside to make room.
export const REST_TURN = Math.PI / 2 - 0.3;
export const LIFT = 1.06;
export const SPREAD = 1.15;
// Rail centre, in slots below the top of the canvas, and where each piece's hook hangs.
const RAIL_Y = -0.2;
export const PIECE_Y = RAIL_Y + 0.03;

const railGeometry = new THREE.CylinderGeometry(0.028, 0.028, 1, 16).rotateZ(Math.PI / 2);
const capGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16).rotateZ(Math.PI / 2);

export function RackCanvas({
  items,
  models,
  hovered,
  hidden,
}: {
  items: Product[];
  models: Record<string, GarmentModel>;
  hovered: number | null;
  hidden: number | null;
}) {
  const width = items.length + 3;
  return (
    <Canvas
      flat
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      className="drop-shadow-[0_12px_12px_rgba(0,0,0,0.12)]"
    >
      <SlotCamera width={width} centerX={width / 2} top={0} />
      <StudioLights area={{ x: width / 2, y: -3, width: width + 2, height: 8 }} />

      <mesh geometry={railGeometry} material={steel} position={[width / 2, RAIL_Y, 0]} scale={[width - 0.12, 1, 1]} />
      <mesh geometry={capGeometry} material={steel} position={[0.06, RAIL_Y, 0]} />
      <mesh geometry={capGeometry} material={steel} position={[width - 0.06, RAIL_Y, 0]} />

      {items.map((product, i) => (
        <RackPiece
          key={product.slug}
          model={models[product.slug]}
          x={i + 2}
          hovered={hovered === i}
          shift={hovered === null || hovered === i ? 0 : Math.sign(i - hovered) * SPREAD}
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
  const swing = useRef({ hovered: false, hidden: false, t: 10 }); // t: seconds since the last swing began

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 7);
    g.rotation.y += ((hovered ? 0 : REST_TURN) - g.rotation.y) * k;
    g.position.x += (x + shift - g.position.x) * k;
    g.scale.setScalar(g.scale.x + ((hovered ? LIFT : 1) - g.scale.x) * k);

    // A small swing on the hook when the piece is picked up, or put back from the product view.
    const s = swing.current;
    if ((hovered && !s.hovered) || (!hidden && s.hidden)) s.t = 0;
    s.hovered = hovered;
    s.hidden = hidden;
    s.t += dt;
    g.rotation.z = 0.04 * Math.sin(s.t * 7) * Math.exp(-s.t * 2.4);
  });

  return (
    <group ref={ref} position={[x, PIECE_Y, 0]} rotation={[0, REST_TURN, 0]} visible={!hidden}>
      <HungGarment model={model} />
    </group>
  );
}
