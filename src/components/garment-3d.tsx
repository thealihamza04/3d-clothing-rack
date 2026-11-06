"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { builtGarmentModel, loadGarmentModel, type GarmentModel } from "@/lib/garment-model";
import type { Photos, Product } from "@/lib/products";

// Local space for a hung piece: the origin is the top of the hook's curl, where it
// rests on the rail, and y runs downward into negative numbers.
const HOOK_BOTTOM = -0.36;
// Where the top edge of every piece sits.
const GARMENT_TOP = -0.42;
// Pants hang lower, from clips under a bar: the bar rests on the hook, a short wire
// drops to each clip, and the clip bites the top of the waistband.
const BAR_Y = HOOK_BOTTOM - 0.045;
const CLIP_TOP = BAR_Y - 0.05;
const CLIP_HEIGHT = 0.16;
const CLIPPED_TOP = CLIP_TOP - 0.06;

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
// A clip, stretched in z to the waistband's depth.
const clipGeometry = new THREE.BoxGeometry(0.13, CLIP_HEIGHT, 1);
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
      castShadow
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

  const offset = garmentOffset(model);
  const hanger = model.hanger;
  return (
    <group>
      <mesh geometry={hookGeometry} material={steel} castShadow />
      {hanger.kind === "clips" ? (
        // The clip hanger: a wooden bar on the hook and a steel clip at each end of the waistband.
        <>
          <Rod from={[-hanger.x - 0.14, BAR_Y]} to={[hanger.x + 0.14, BAR_Y]} />
          {[-hanger.x, hanger.x].map((x) => (
            <group key={x}>
              <Rod wire from={[x, BAR_Y]} to={[x, CLIP_TOP]} />
              <mesh
                castShadow
                geometry={clipGeometry}
                material={steel}
                position={[x, CLIP_TOP - CLIP_HEIGHT / 2, (hanger.front + hanger.back) / 2]}
                scale={[1, 1, hanger.front - hanger.back + 0.05]}
              />
            </group>
          ))}
        </>
      ) : (
        // The wooden hanger: a short neck, two arms out to the shoulders, and a wire up to the hook.
        <>
          <Rod from={[0, hanger.centre + offset]} to={[0, Math.min(hanger.centre + offset + NECK, HOOK_BOTTOM + 0.02)]} />
          {hanger.centre + offset + NECK < HOOK_BOTTOM && (
            <Rod wire from={[0, hanger.centre + offset + NECK - 0.02]} to={[0, HOOK_BOTTOM + 0.01]} />
          )}
          <Rod from={[0, hanger.centre + offset]} to={[-hanger.reach, hanger.end + offset]} />
          <Rod from={[0, hanger.centre + offset]} to={[hanger.reach, hanger.end + offset]} />
        </>
      )}
      <mesh geometry={model.geometry} material={model.materials} position={[0, offset, 0]} castShadow receiveShadow />
    </group>
  );
}

// How far down the piece is moved so its top edge hangs where its hanger holds it.
function garmentOffset(model: GarmentModel) {
  return (model.hanger.kind === "clips" ? CLIPPED_TOP : GARMENT_TOP) - model.top;
}

// How far a hung piece reaches below its hook (a negative y, in slots).
export function garmentBottom(model: GarmentModel) {
  if (!model.geometry.boundingBox) model.geometry.computeBoundingBox();
  return garmentOffset(model) + model.geometry.boundingBox!.min.y;
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

  // Models built earlier (say, for the rack) are there straight away, without waiting
  // a frame for the effect.
  const ready = { ...models };
  for (const product of items) {
    const done = ready[product.slug] ?? builtGarmentModel(product, photos[product.slug] ?? {});
    if (done) ready[product.slug] = done;
  }
  return ready;
}

// Lighting shared by every scene: soft studio light from the front, a little from behind.
// Given an `area` (centre and size, in slots), the front light also casts soft, faint
// shadows there, so pieces that overlap on the rail shade each other.
export function StudioLights({ area }: { area?: { x: number; y: number; width: number; height: number } }) {
  const [target] = useState(() => new THREE.Object3D());
  const at = area ?? { x: 0, y: 0, width: 0, height: 0 };
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d8d4cc", 1.6]} />
      <primitive object={target} position={[at.x, at.y, 0]} />
      <directionalLight
        target={target}
        position={[at.x + 3, at.y + 4, 9]}
        intensity={1.5}
        castShadow={!!area}
        shadow-mapSize={[2048, 1024]}
        shadow-camera-left={-at.width / 2}
        shadow-camera-right={at.width / 2}
        shadow-camera-top={at.height / 2}
        shadow-camera-bottom={-at.height / 2}
        shadow-camera-near={4}
        shadow-camera-far={18}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-radius={6}
        shadow-intensity={0.45}
      />
      <directionalLight position={[-6, 2, -4]} intensity={0.5} />
    </>
  );
}

// The pixel density to draw a canvas at: the screen's own, times any pinch zoom, so
// zooming in shows real detail instead of a stretched picture. Rounded up to halves
// (so pinching doesn't resize the canvas every frame) and capped at 3 to stay light.
export function useZoomDpr() {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const wanted = window.devicePixelRatio * (viewport?.scale ?? 1);
      setDpr(Math.min(3, Math.max(1, Math.ceil(wanted * 2) / 2)));
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
    };
  }, []);
  return dpr;
}

// A narrow field of view, so pieces barely change shape across the rack.
export const FOV = 11;

// Sets up a camera where one world unit spans the same number of pixels as one rack
// slot: `width` units fill the canvas width, centred on centerX, with `top` at the
// top edge.
export function SlotCamera({ width, centerX, top }: { width: number; centerX: number; top: number }) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const camera = get().camera as THREE.PerspectiveCamera;
    const height = (width * size.height) / size.width;
    const distance = height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.fov = FOV;
    camera.near = 1;
    camera.far = distance + 20;
    camera.position.set(centerX, top - height / 2, distance);
    camera.updateProjectionMatrix();
  }, [get, size, width, centerX, top]);

  return null;
}
