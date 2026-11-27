import * as THREE from "three";
import { Fighter, boxesOverlap } from "./Fighter";
import { readInput, consumeAttack } from "./input";
import { meterGain, scaleChampStats } from "./progression";
import type { ChampDef, Stats } from "./types";

export type FightHud = {
  pHealth: number;
  pMax: number;
  rHealth: number;
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
    this.renderer.setClearColor(opts.arenaTint, 1);
    this.renderer.domElement.className = "fight-canvas";
    canvasHost.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(opts.arenaTint, 0.035);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 2.4, 9.5);

    this.buildArena();
    this.resetRound(true);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  private buildArena(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 8),
      new THREE.MeshStandardMaterial({
        color: 0x1a1410,
        roughness: 0.9,
        metalness: 0.1,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(24, 24, 0xffd400, 0x333028);
    grid.position.y = 0.01;
    this.scene.add(grid);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 10),
      new THREE.MeshStandardMaterial({
        color: this.arenaTint,
        emissive: 0xff2e88,
        emissiveIntensity: 0.08,
        roughness: 1,
      }),
    );
    back.position.set(0, 4, -4);
    this.scene.add(back);

    for (const x of [this.walls.left - 0.3, this.walls.right + 0.3]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 4, 3),
        new THREE.MeshStandardMaterial({
          color: 0x2a221c,
          emissive: 0xffd400,
          emissiveIntensity: 0.15,
        }),
      );
      wall.position.set(x, 2, 0);
      this.scene.add(wall);
    }

    const ambient = new THREE.AmbientLight(0x8866aa, 0.55);
    const key = new THREE.DirectionalLight(0xffe0a0, 1.1);
    key.position.set(3, 8, 5);
    const rim = new THREE.PointLight(0xff2e88, 1.4, 30);
    rim.position.set(-4, 3, 2);
    this.scene.add(ambient, key, rim);
  }

  private resetRound(initial: boolean): void {
    if (this.player) this.scene.remove(this.player.mesh);
    if (this.rival) this.scene.remove(this.rival.mesh);

    this.player = new Fighter({
      name: this.playerName,
      stats: this.playerStats,
      color: 0xffd400,
      accent: 0xffaa00,
      facing: 1,
      x: -2.5,
      isPlayer: true,
    });
    const rivalStats = scaleChampStats(this.champ.stats, this.champ.level);
    this.rival = new Fighter({
      name: this.champ.name,
      stats: rivalStats,
      color: 0xff2e88,
      accent: 0xff66aa,
      facing: -1,
      x: 2.5,
      isPlayer: false,
    });
    this.scene.add(this.player.mesh, this.rival.mesh);
    this.hitLatch.clear();
    this.freeze = initial ? 1.1 : 0.85;
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
      this.frameCamera();
      this.renderer.render(this.scene, this.camera);
      this.pushHud();
      return null;
    }

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

    // Soft push apart if overlapping
    const gap = this.rival.x - this.player.x;
    if (Math.abs(gap) < 0.75) {
      const push = (0.75 - Math.abs(gap)) * 0.5;
      this.player.x -= Math.sign(gap || 1) * push;
      this.rival.x += Math.sign(gap || 1) * push;
    }

    if (this.player.dead || this.rival.dead) {
      const winner: FightResult = this.rival.dead ? "player" : "rival";
      if (winner === "player") this.roundWins.player += 1;
      else this.roundWins.rival += 1;

      if (this.roundWins.player >= 2 || this.roundWins.rival >= 2) {
        this.finished = winner;
        this.banner = winner === "player" ? "YOU WIN" : "DEFEAT";
        this.bannerTimer = 2;
        this.freeze = 2;
      } else {
        this.banner = winner === "player" ? "ROUND WIN" : "ROUND LOST";
        this.bannerTimer = 1.2;
        this.freeze = 1.2;
        this.pendingReset = true;
      }
    }

    this.frameCamera();
    this.renderer.render(this.scene, this.camera);
    this.pushHud();
    return this.finished;
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
  }

  private frameCamera(): void {
    const mid = (this.player.x + this.rival.x) / 2;
    const dist = Math.abs(this.player.x - this.rival.x);
    const z = THREE.MathUtils.clamp(8.2 + dist * 0.35, 8.2, 12);
    this.camera.position.x += (mid - this.camera.position.x) * 0.08;
    this.camera.position.z += (z - this.camera.position.z) * 0.06;
    this.camera.lookAt(mid, 1.4, 0);
  }

  private pushHud(): void {
    this.onHud({
      pHealth: this.player.health,
      pMax: this.player.maxHealth,
      rHealth: this.rival.health,
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
