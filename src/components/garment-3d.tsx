"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { loadGarmentModel, type GarmentModel } from "@/lib/garment-model";
import type { Photos, Product } from "@/lib/products";

// Local space for a hung piece: the origin is the top of the hook's curl, where it
// rests on the rail, and y runs downward into negative numbers.
const HOOK_BOTTOM = -0.36;
// Where the top edge of every piece sits.
const GARMENT_TOP = -0.42;

export const steel = new THREE.MeshStandardMaterial({ color: "#9a9aa0", metalness: 0.8, roughness: 0.3 });
const wood = new THREE.MeshStandardMaterial({ color: "#8a5536", roughness: 0.6 });

// The hook curls over the rail in the same plane as the piece's sides, so it reads
// as a "?" while the piece hangs side-on and as a straight wire when it faces you.
const hookGeometry = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, HOOK_BOTTOM, 0),
    new THREE.Vector3(0, -0.24, 0),
    new THREE.Vector3(0, -0.1, 0.005),
    new THREE.Vector3(0, -0.02, 0.04),
    new THREE.Vector3(0, 0, 0.09),
    new THREE.Vector3(0, -0.04, 0.14),
    new THREE.Vector3(0, -0.11, 0.15),
  ]),
  48,
  0.018,
  8,
);

// Unit-length rods along y, stretched and turned into place for each part: wooden
// for the hanger, thin steel for the wire up to the hook.
const rodGeometry = new THREE.CapsuleGeometry(0.045, 1, 4, 12);
const wireGeometry = new THREE.CylinderGeometry(0.018, 0.018, 1, 8);
const up = new THREE.Vector3(0, 1, 0);
// The wooden neck stays short; if the collar dips lower (a V-neck, an open hood),
// the steel wire runs the rest of the way up, as on a real hanger.
const NECK = 0.12;

function Rod({
  from,
  to,
  wire = false,
}: {
  from: [number, number];
  to: [number, number];
  wire?: boolean;
}) {
  const a = new THREE.Vector3(from[0], from[1], 0);
  const b = new THREE.Vector3(to[0], to[1], 0);
  const dir = b.clone().sub(a);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return (
    <mesh
      geometry={wire ? wireGeometry : rodGeometry}
      material={wire ? steel : wood}
      position={mid}
      quaternion={quaternion}
      scale={[1, Math.max(dir.length() - (wire ? 0 : 0.09), 0.001), 1]}
    />
  );
}

export function HungGarment({ model }: { model?: GarmentModel }) {
  if (!model) return <mesh geometry={hookGeometry} material={steel} />;

  const offset = GARMENT_TOP - model.top;
  const { reach, centre, end } = model.hanger;
  return (
    <group>
      <mesh geometry={hookGeometry} material={steel} />
      {/* The wooden hanger: a short neck, two arms out to the shoulders, and a wire up to the hook. */}
      <Rod from={[0, centre + offset]} to={[0, Math.min(centre + offset + NECK, HOOK_BOTTOM + 0.02)]} />
      {centre + offset + NECK < HOOK_BOTTOM && (
        <Rod wire from={[0, centre + offset + NECK - 0.02]} to={[0, HOOK_BOTTOM + 0.01]} />
      )}
      <Rod from={[0, centre + offset]} to={[-reach, end + offset]} />
      <Rod from={[0, centre + offset]} to={[reach, end + offset]} />
      <mesh geometry={model.geometry} material={model.materials} position={[0, offset, 0]} />
    </group>
  );
}

// Inside a <Canvas> effects don't run reliably, so models are loaded out here in the
// page's own React tree and handed to the scene.
export function useGarmentModels(items: Product[], photos: Photos) {
  const [models, setModels] = useState<Record<string, GarmentModel>>({});
  const key = items.map((p) => `${p.slug}:${Object.values(photos[p.slug] ?? {}).join(",")}`).join("|");

  useEffect(() => {
    let live = true;
    for (const product of items) {
      loadGarmentModel(product, photos[product.slug] ?? {}).then(
        (model) => live && setModels((m) => ({ ...m, [product.slug]: model })),
      );
    }
    return () => {
      live = false;
    };
    // The key covers everything the models depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return models;
}

// Lighting shared by every scene: soft studio light from the front, a little from behind.
export function StudioLights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d8d4cc", 1.6]} />
      <directionalLight position={[3, 4, 9]} intensity={1.5} />
      <directionalLight position={[-6, 2, -4]} intensity={0.5} />
    </>
  );
}

// Sets up a camera where one world unit spans the same number of pixels as one rack
// slot: `width` units fill the canvas width, centred on centerX, with `top` at the
// top edge. A narrow field of view keeps the perspective gentle.
export function SlotCamera({ width, centerX, top }: { width: number; centerX: number; top: number }) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera;
    const height = (width * size.height) / size.width;
    const fov = 11;
    const distance = height / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    camera.fov = fov;
    camera.near = 1;
    camera.far = distance + 20;
    camera.position.set(centerX, top - height / 2, distance);
    camera.updateProjectionMatrix();
  }, [get, size, width, centerX, top]);

  return null;
}
