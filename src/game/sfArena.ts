import * as THREE from "three";

export type SfArena = {
  root: THREE.Group;
  /** Distant layers shifted opposite the camera for cheap parallax. */
  parallaxFar: THREE.Object3D[];
  parallaxMid: THREE.Object3D[];
};

function canvasTexture(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");
  paint(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function skyTexture(tint: number): THREE.CanvasTexture {
  const c = new THREE.Color(tint);
  return canvasTexture(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1a0a28");
    g.addColorStop(0.35, "#4a1a4a");
    g.addColorStop(0.55, `rgb(${Math.floor(c.r * 180 + 40)},${Math.floor(c.g * 60 + 30)},${Math.floor(c.b * 90 + 50)})`);
    g.addColorStop(0.75, "#ff7a3c");
    g.addColorStop(0.9, "#ffc14d");
    g.addColorStop(1, "#ffe9a8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Soft sun disc
    const sun = ctx.createRadialGradient(w * 0.5, h * 0.72, 2, w * 0.5, h * 0.72, 40);
    sun.addColorStop(0, "rgba(255,255,220,0.95)");
    sun.addColorStop(0.4, "rgba(255,160,60,0.45)");
    sun.addColorStop(1, "rgba(255,100,40,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  });
}

function groundTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#3a3228";
    ctx.fillRect(0, 0, w, h);
    // Asphalt noise stripes
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? "#322b22" : "#40362c";
      ctx.fillRect(0, y, w, 8);
    }
    // Center court paint
    ctx.fillStyle = "#e8b820";
    ctx.fillRect(0, h * 0.46, w, h * 0.08);
    // Side gutters
    ctx.fillStyle = "#1e1814";
    ctx.fillRect(0, 0, w, h * 0.12);
    ctx.fillRect(0, h * 0.88, w, h * 0.12);
    // Checker curb
    const cell = 24;
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = (x / cell) % 2 === 0 ? "#f2f2f0" : "#1a1a1a";
      ctx.fillRect(x, h * 0.1, cell, h * 0.05);
      ctx.fillRect(x, h * 0.85, cell, h * 0.05);
    }
    // Lane dashes
    ctx.fillStyle = "rgba(255,230,120,0.55)";
    for (let x = 20; x < w; x += 64) {
      ctx.fillRect(x, h * 0.48, 36, h * 0.04);
    }
  });
}

function windowBuildingTexture(base: string, glow: string): THREE.CanvasTexture {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 8;
    const mw = w / (cols + 1);
    const mh = h / (rows + 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = (r * 3 + c * 7) % 5 !== 0;
        ctx.fillStyle = lit ? glow : "#0a0810";
        ctx.fillRect(mw * 0.55 + c * mw, mh * 1.1 + r * mh, mw * 0.55, mh * 0.55);
      }
    }
    // Roofline neon
    ctx.fillStyle = glow;
    ctx.fillRect(0, 6, w, 5);
  });
}

function neonSignTexture(label: string, bg: string, fg: string): THREE.CanvasTexture {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = "#0a0610";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = bg;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(18, 18, w - 36, h - 36);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = fg;
    ctx.shadowBlur = 18;
    ctx.fillText(label, w / 2, h / 2 + 4);
  });
}

/**
 * Classic 2.5D Street Fighter–style stage: dusk sky, layered city,
 * lit windows, neon sign, crowd rail, and painted street.
 */
export function buildSfArena(arenaTint: number): SfArena {
  const root = new THREE.Group();
  const parallaxFar: THREE.Object3D[] = [];
  const parallaxMid: THREE.Object3D[] = [];
  const tint = new THREE.Color(arenaTint);

  // --- Sky ---
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 28),
    new THREE.MeshBasicMaterial({ map: skyTexture(arenaTint), depthWrite: false }),
  );
  sky.position.set(0, 8, -18);
  root.add(sky);
  parallaxFar.push(sky);

  // Soft fog plane above horizon
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffb070,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  haze.position.set(0, 3.2, -16.5);
  root.add(haze);
  parallaxFar.push(haze);

  // --- Far city silhouette ---
  const farCity = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const h = 3 + ((i * 17) % 5) * 1.1;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(2.4 + (i % 3) * 0.4, h, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x140c1c,
        emissive: tint,
        emissiveIntensity: 0.08,
        roughness: 1,
      }),
    );
    slab.position.set(-16 + i * 2.45, h * 0.5, -12 - (i % 3) * 0.6);
    farCity.add(slab);
  }
  root.add(farCity);
  parallaxFar.push(farCity);

  // --- Mid buildings with windows ---
  const midCity = new THREE.Group();
  const winA = windowBuildingTexture("#2a1830", "#ffd36a");
  const winB = windowBuildingTexture("#1a2038", "#7cf0ff");
  const winC = windowBuildingTexture("#301820", "#ff6ec7");
  const winMaps = [winA, winB, winC];
  for (let i = 0; i < 9; i++) {
    const h = 4.2 + (i % 4) * 1.35;
    const mat = new THREE.MeshStandardMaterial({
      map: winMaps[i % 3],
      roughness: 0.75,
      metalness: 0.15,
      emissive: i % 2 === 0 ? 0xff2e88 : 0x2de2e6,
      emissiveIntensity: 0.12,
    });
    const bldg = new THREE.Mesh(new THREE.BoxGeometry(2.6, h, 2.2), mat);
    bldg.position.set(-11 + i * 2.8, h * 0.5, -7.2 - (i % 2) * 0.9);
    midCity.add(bldg);
  }
  root.add(midCity);
  parallaxMid.push(midCity);

  // Neon billboard
  const signMap = neonSignTexture("FISHBOWL", "#ff2bd6", "#ffe56a");
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 1.8),
    new THREE.MeshBasicMaterial({ map: signMap, transparent: true }),
  );
  sign.position.set(0, 6.4, -5.6);
  root.add(sign);
  parallaxMid.push(sign);

  const signGlow = new THREE.PointLight(0xff2bd6, 2.2, 18);
  signGlow.position.set(0, 6.2, -4.5);
  root.add(signGlow);

  // Side neon towers
  for (const x of [-8.5, 8.5]) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 7.5, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x101018,
        emissive: x < 0 ? 0xff2e88 : 0x2de2e6,
        emissiveIntensity: 0.85,
        roughness: 0.4,
        metalness: 0.5,
      }),
    );
    tower.position.set(x, 3.75, -4.2);
    root.add(tower);
    const bulb = new THREE.PointLight(x < 0 ? 0xff2e88 : 0x2de2e6, 1.4, 14);
    bulb.position.set(x, 6.5, -3.4);
    root.add(bulb);
  }

  // --- Crowd rail / barrier ---
  const rail = new THREE.Group();
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(22, 0.55, 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x1a1510,
      emissive: 0xffd400,
      emissiveIntensity: 0.25,
      metalness: 0.4,
      roughness: 0.45,
    }),
  );
  barrier.position.set(0, 0.55, -3.35);
  rail.add(barrier);

  for (let i = 0; i < 18; i++) {
    const person = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.45, 4, 8),
      new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0xff5aa5 : i % 3 === 1 ? 0x4ad6ff : 0xffd060,
        roughness: 0.8,
        emissive: 0x110818,
        emissiveIntensity: 0.2,
      }),
    );
    person.position.set(-8.5 + i * 1.0, 1.15, -3.7 - (i % 2) * 0.25);
    rail.add(person);
  }
  root.add(rail);
  parallaxMid.push(rail);

  // --- Street / ring floor ---
  const groundMap = groundTexture();
  groundMap.wrapS = THREE.RepeatWrapping;
  groundMap.wrapT = THREE.ClampToEdgeWrapping;
  groundMap.repeat.set(2, 1);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 12),
    new THREE.MeshStandardMaterial({
      map: groundMap,
      roughness: 0.92,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  root.add(floor);

  // Perspective stage lip (front edge strip)
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.25, 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x0e0a08,
      emissive: tint,
      emissiveIntensity: 0.15,
      roughness: 0.7,
    }),
  );
  lip.position.set(0, 0.05, 4.6);
  root.add(lip);

  // Side walls / out-of-bounds pillars (classic SF stage edges)
  for (const x of [-8.2, 8.2]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 5.2, 5.5),
      new THREE.MeshStandardMaterial({
        color: 0x16101a,
        emissive: tint,
        emissiveIntensity: 0.18,
        roughness: 0.85,
      }),
    );
    wall.position.set(x, 2.5, 0.2);
    root.add(wall);

    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 4.6),
      new THREE.MeshBasicMaterial({ color: 0xffd400 }),
    );
    stripe.position.set(x + (x < 0 ? 0.36 : -0.36), 2.4, 1.5);
    root.add(stripe);
  }

  // Floor bounce light (stage wash)
  const stageWash = new THREE.PointLight(0xffc878, 1.35, 22);
  stageWash.position.set(0, 3.5, 2);
  root.add(stageWash);

  return { root, parallaxFar, parallaxMid };
}

/** Shift parallax layers based on camera X for a 2.5D stage feel. */
export function updateSfParallax(
  arena: SfArena,
  cameraX: number,
): void {
  for (const obj of arena.parallaxFar) {
    obj.position.x = cameraX * 0.55;
  }
  for (const obj of arena.parallaxMid) {
    obj.position.x = cameraX * 0.28;
  }
}
