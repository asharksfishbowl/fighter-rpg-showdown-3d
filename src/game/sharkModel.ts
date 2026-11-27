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
  const url = `${import.meta.env.BASE_URL}models/shark-fighter.glb`;

  loadPromise = loader.loadAsync(url).then((gltf) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const height = Math.max(size.y, 0.001);
    const scale = TARGET_HEIGHT / height;

    // Face down the longer horizontal axis toward +X for side-view bouts.
    const facingGroup = new THREE.Group();
    if (size.z >= size.x) {
      facingGroup.rotation.y = -Math.PI / 2;
    }
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    facingGroup.add(root);

    facingGroup.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(facingGroup);
    facingGroup.position.y -= box2.min.y;

    // Ensure albedo maps sample in sRGB so the Tripo texture reads correctly.
    facingGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (mat && "map" in mat && mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.needsUpdate = true;
        }
      }
    });

    template = facingGroup;
    return template;
  });

  return loadPromise;
}

/**
 * Clone a shark fighter. Keeps the authored albedo texture intact.
 * `accent` only drives a small team ring + hit-flash emissive, not a full recolor.
 */
export function cloneSharkFighter(_color: number, accent: number): {
  root: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  accent: number;
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
          : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
      // Preserve texture look — do not wash albedo with team colors.
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.color.setRGB(1, 1, 1);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      mat.roughness = mat.roughness ?? 0.9;
      mat.metalness = mat.metalness ?? 0;
      mat.needsUpdate = true;
      materials.push(mat);
      return mat;
    });
    obj.material = next.length === 1 ? next[0]! : next;
    obj.castShadow = false;
    obj.receiveShadow = false;
  });

  // Team ring under the feet so player/rival stay distinct without recoloring the mesh.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.58, 32),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.name = "team-ring";

  root.add(clone, ring);
  return { root, materials, accent };
}
