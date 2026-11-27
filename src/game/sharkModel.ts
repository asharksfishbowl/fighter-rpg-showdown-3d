import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Desired fighter height in arena units (feet on ground → head). */
const TARGET_HEIGHT = 1.95;

let template: THREE.Object3D | null = null;
let loadPromise: Promise<THREE.Object3D> | null = null;

/**
 * Load the humanoid shark-person GLB once, normalize so it stands on y=0
 * facing +X (toward the rival when facing === 1).
 */
export function preloadSharkFighter(): Promise<THREE.Object3D> {
  if (template) return Promise.resolve(template);
  if (loadPromise) return loadPromise;

  const loader = new GLTFLoader();
  // Vite base is /fighter/ in production — relative public URL works either way.
  const url = `${import.meta.env.BASE_URL}models/shark-fighter.glb`;

  loadPromise = loader.loadAsync(url).then((gltf) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Center horizontally, plant on ground, scale to fighter height.
    const height = Math.max(size.y, 0.001);
    const scale = TARGET_HEIGHT / height;

    // Prefer facing down the longer horizontal axis toward +X.
    const facingGroup = new THREE.Group();
    if (size.z >= size.x) {
      facingGroup.rotation.y = -Math.PI / 2;
    }
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    facingGroup.add(root);

    // Re-measure after rotation so feet stay planted.
    facingGroup.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(facingGroup);
    facingGroup.position.y -= box2.min.y;

    template = facingGroup;
    return template;
  });

  return loadPromise;
}

/** @deprecated Prefer preloadSharkFighter */
export const preloadNeonShark = preloadSharkFighter;

/**
 * Clone a tinted shark fighter ready to parent under a Fighter mesh.
 * Materials are cloned so player/rival colors stay independent.
 */
export function cloneSharkFighter(color: number, accent: number): {
  root: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
} {
  if (!template) {
    throw new Error("Shark fighter model not preloaded — call preloadSharkFighter() first");
  }

  const root = new THREE.Group();
  const clone = template.clone(true);
  const materials: THREE.MeshStandardMaterial[] = [];

  clone.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const src = obj.material;
    const mats = Array.isArray(src) ? src : [src];
    const next = mats.map((m) => {
      const mat =
        m instanceof THREE.MeshStandardMaterial
          ? m.clone()
          : new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35 });
      // Keep texture maps; nudge albedo/emissive toward team colors.
      mat.color.lerp(new THREE.Color(color), 0.55);
      mat.emissive.setHex(accent);
      mat.emissiveIntensity = 0.42;
      mat.roughness = Math.min(mat.roughness ?? 0.45, 0.55);
      mat.metalness = Math.max(mat.metalness ?? 0.15, 0.25);
      materials.push(mat);
      return mat;
    });
    obj.material = next.length === 1 ? next[0]! : next;
    obj.castShadow = false;
    obj.receiveShadow = false;
  });

  root.add(clone);
  return { root, materials };
}

/** @deprecated Prefer cloneSharkFighter */
export const cloneNeonShark = cloneSharkFighter;
