import * as THREE from "three";
import { Fighter, boxesOverlap } from "./Fighter";
import { readInput, consumeAttack } from "./input";
import { meterGain, scaleChampStats } from "./progression";
import type { ChampDef, Stats } from "./types";

export type FightHud = {
  pHealth: number;
  pChip: number;
  pMax: number;
  rHealth: number;
  rChip: number;
  rMax: number;
  pMeter: number;
  rMeter: number;
  pRounds: number;
  rRounds: number;
  pName: string;
  rName: string;
  pLevel: number;
  rLevel: number;
  banner: string;
  timer: number;
};

type FightResult = "player" | "rival";

export class FightScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  player!: Fighter;
  rival!: Fighter;
  private walls = { left: -7.5, right: 7.5 };
  private hitLatch = new Set<string>();
  private roundWins = { player: 0, rival: 0 };
  private freeze = 0;
  private banner = "";
  private bannerTimer = 0;
  private finished: FightResult | null = null;
  private pendingReset = false;
  private onHud: (hud: FightHud) => void;
  private playerStats: Stats;
  private playerName: string;
  private playerLevel: number;
  private champ: ChampDef;
  private arenaTint: number;
  private sparks: THREE.Points;
  private sparkLife: Float32Array;
  private shake = 0;
  private roundTime = 99;

  constructor(
    canvasHost: HTMLElement,
    opts: {
      playerName: string;
      playerLevel: number;
      playerStats: Stats;
      champ: ChampDef;
      arenaTint: number;
      onHud: (hud: FightHud) => void;
    },
  ) {
    this.onHud = opts.onHud;
    this.playerStats = opts.playerStats;
    this.playerName = opts.playerName;
    this.playerLevel = opts.playerLevel;
    this.champ = opts.champ;
    this.arenaTint = opts.arenaTint;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x0a0810, 1);
    this.renderer.domElement.className = "fight-canvas";
    canvasHost.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a0810, 12, 28);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 2.6, 10.2);

    this.sparks = this.makeSparks();
    this.sparkLife = new Float32Array(48);
    this.scene.add(this.sparks);

    this.buildArena();
    this.resetRound(true);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  private makeSparks(): THREE.Points {
    const count = 48;
    const positions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd400,
      size: 0.18,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, mat);
  }

  private burstSparks(x: number, y: number): void {
    const arr = this.sparks.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < 48; i++) {
      arr[i * 3] = x + (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 1] = y + (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      this.sparkLife[i] = 0.25 + Math.random() * 0.2;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    (this.sparks.material as THREE.PointsMaterial).opacity = 1;
    this.shake = 0.22;
  }

  private buildArena(): void {
    // Ring floor with SF-style painted lanes
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 10),
      new THREE.MeshStandardMaterial({
        color: 0x2a2218,
        roughness: 0.85,
        metalness: 0.08,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xffd400 }),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, 0.03, 0);
    this.scene.add(lane);

    // Crowd / city backdrop slabs for depth
    for (let i = 0; i < 7; i++) {
      const h = 2.5 + (i % 3) * 1.4;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, h, 1.4),
        new THREE.MeshStandardMaterial({
          color: this.arenaTint,
          emissive: i % 2 === 0 ? 0xff2e88 : 0x2de2e6,
          emissiveIntensity: 0.12,
          roughness: 0.9,
        }),
      );
      bldg.position.set(-9 + i * 3, h * 0.5, -5.5 - (i % 2) * 0.8);
      this.scene.add(bldg);
    }

    const backGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 12),
      new THREE.MeshBasicMaterial({
        color: this.arenaTint,
        transparent: true,
        opacity: 0.85,
      }),
    );
    backGlow.position.set(0, 4.5, -7);
    this.scene.add(backGlow);

    // Neon billboard
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xffd400 }),
    );
    sign.position.set(0, 5.2, -4.8);
    this.scene.add(sign);

    for (const x of [this.walls.left - 0.35, this.walls.right + 0.35]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 4.5, 4),
        new THREE.MeshStandardMaterial({
          color: 0x1a1510,
          emissive: 0xffd400,
          emissiveIntensity: 0.2,
        }),
      );
      wall.position.set(x, 2.2, 0);
      this.scene.add(wall);
    }

    const ambient = new THREE.AmbientLight(0x665588, 0.65);
    const key = new THREE.DirectionalLight(0xffe8c0, 1.25);
    key.position.set(4, 10, 6);
    const rim = new THREE.PointLight(0xff2e88, 1.8, 35);
    rim.position.set(-5, 3.5, 3);
    const fill = new THREE.PointLight(0x2de2e6, 1.1, 30);
    fill.position.set(5, 2.5, 2);
    this.scene.add(ambient, key, rim, fill);
  }

  private resetRound(initial: boolean): void {
    if (this.player) this.scene.remove(this.player.mesh);
    if (this.rival) this.scene.remove(this.rival.mesh);

    this.player = new Fighter({
      name: this.playerName,
      stats: this.playerStats,
      color: 0xf0c420,
      accent: 0xff7a00,
      facing: 1,
      x: -2.6,
      isPlayer: true,
    });
    const rivalStats = scaleChampStats(this.champ.stats, this.champ.level);
    this.rival = new Fighter({
      name: this.champ.name,
      stats: rivalStats,
      color: 0xc01050,
      accent: 0xff2e88,
      facing: -1,
      x: 2.6,
      isPlayer: false,
    });
    this.scene.add(this.player.mesh, this.rival.mesh);
    this.hitLatch.clear();
    this.roundTime = 99;
    this.freeze = initial ? 1.15 : 0.9;
    this.banner = initial ? "FIGHT" : "ROUND";
    this.bannerTimer = this.freeze;
    this.pushHud();
  }

  update(dt: number): FightResult | null {
    if (this.finished) return this.finished;

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner = "";
    }
    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0 && this.pendingReset) {
        this.pendingReset = false;
        this.resetRound(false);
      }
      this.tickSparks(dt);
      this.frameCamera();
      this.renderer.render(this.scene, this.camera);
      this.pushHud();
      return null;
    }

    this.roundTime = Math.max(0, this.roundTime - dt);

    const input = readInput();
    this.player.faceToward(this.rival.x);
    this.rival.faceToward(this.player.x);
    this.player.updatePlayer(dt, input, this.walls);
    this.rival.updateAI(dt, this.player, this.walls);

    if (input.light || input.heavy || input.special) {
      consumeAttack(["j", "k", "l"]);
    }

    this.resolveHits(this.player, this.rival);
    this.resolveHits(this.rival, this.player);

    const gap = this.rival.x - this.player.x;
    if (Math.abs(gap) < 0.8) {
      const push = (0.8 - Math.abs(gap)) * 0.5;
      this.player.x -= Math.sign(gap || 1) * push;
      this.rival.x += Math.sign(gap || 1) * push;
    }

    if (this.roundTime <= 0 && !this.player.dead && !this.rival.dead) {
      if (this.player.health === this.rival.health) {
        this.player.health = 0;
        this.rival.health = 0;
      } else if (this.player.health > this.rival.health) this.rival.health = 0;
      else this.player.health = 0;
      this.player.dead = this.player.health <= 0;
      this.rival.dead = this.rival.health <= 0;
    }

    if (this.player.dead || this.rival.dead) {
      const winner: FightResult = this.rival.dead && !this.player.dead
        ? "player"
        : this.player.dead && !this.rival.dead
          ? "rival"
          : this.player.health >= this.rival.health
            ? "player"
            : "rival";
      if (winner === "player") this.roundWins.player += 1;
      else this.roundWins.rival += 1;

      if (this.roundWins.player >= 2 || this.roundWins.rival >= 2) {
        this.finished = winner;
        this.banner = winner === "player" ? "YOU WIN" : "K.O.";
        this.bannerTimer = 2;
        this.freeze = 2;
      } else {
        this.banner = winner === "player" ? "ROUND WIN" : "ROUND LOST";
        this.bannerTimer = 1.2;
        this.freeze = 1.2;
        this.pendingReset = true;
      }
    }

    this.tickSparks(dt);
    this.frameCamera();
    this.renderer.render(this.scene, this.camera);
    this.pushHud();
    return this.finished;
  }

  private tickSparks(dt: number): void {
    const arr = this.sparks.geometry.attributes.position.array as Float32Array;
    let alive = false;
    for (let i = 0; i < 48; i++) {
      if (this.sparkLife[i] > 0) {
        this.sparkLife[i] -= dt;
        arr[i * 3] += (Math.random() - 0.5) * 0.15;
        arr[i * 3 + 1] += 0.8 * dt + Math.random() * 0.05;
        alive = alive || this.sparkLife[i] > 0;
      }
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    const mat = this.sparks.material as THREE.PointsMaterial;
    mat.opacity = alive ? Math.min(1, mat.opacity) : Math.max(0, mat.opacity - dt * 4);
    if (this.shake > 0) this.shake -= dt;
  }

  private resolveHits(attacker: Fighter, defender: Fighter): void {
    const box = attacker.attackBox;
    if (!box || !attacker.attackKind) return;
    const key = `${attacker.name}-${attacker.attackKind}-${Math.floor(attacker.attackActive * 20)}`;
    if (this.hitLatch.has(key)) return;
    if (!boxesOverlap(box, defender.hitbox)) return;
    this.hitLatch.add(key);
    const dmg = attacker.damageFor(attacker.attackKind);
    const knock = attacker.knockFor(attacker.attackKind);
    defender.takeHit(dmg, knock, attacker.facing);
    attacker.meter = Math.min(
      attacker.maxMeter,
      attacker.meter + meterGain(attacker.stats),
    );
    this.burstSparks(
      (attacker.x + defender.x) * 0.5,
      box.y + box.h * 0.5,
    );
  }

  private frameCamera(): void {
    const mid = (this.player.x + this.rival.x) / 2;
    const dist = Math.abs(this.player.x - this.rival.x);
    const z = THREE.MathUtils.clamp(8.5 + dist * 0.38, 8.5, 12.5);
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.35 : 0;
    this.camera.position.x += (mid + shakeX - this.camera.position.x) * 0.1;
    this.camera.position.y += (2.55 + shakeY - this.camera.position.y) * 0.08;
    this.camera.position.z += (z - this.camera.position.z) * 0.07;
    this.camera.lookAt(mid, 1.45, 0);
  }

  private pushHud(): void {
    this.onHud({
      pHealth: this.player.health,
      pChip: this.player.chipHealth,
      pMax: this.player.maxHealth,
      rHealth: this.rival.health,
      rChip: this.rival.chipHealth,
      rMax: this.rival.maxHealth,
      pMeter: this.player.meter,
      rMeter: this.rival.meter,
      pRounds: this.roundWins.player,
      rRounds: this.roundWins.rival,
      pName: this.player.name,
      rName: this.rival.name,
      pLevel: this.playerLevel,
      rLevel: this.champ.level,
      banner: this.banner,
      timer: Math.ceil(this.roundTime),
    });
  }

  private resize = (): void => {
    const parent = this.renderer.domElement.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  dispose(): void {
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
