import * as THREE from "three";
import type { InputState } from "./input";
import {
  attackRate,
  heavyDamage,
  lightDamage,
  maxHp,
  meterGain,
  moveSpeed,
  specialDamage,
} from "./progression";
import { cloneSharkFighter } from "./sharkModel";
import type { Stats } from "./types";

export type AttackKind = "light" | "heavy" | "special" | null;

type FighterOpts = {
  name: string;
  stats: Stats;
  color: number;
  accent: number;
  facing: 1 | -1;
  x: number;
  isPlayer: boolean;
};

/**
 * Humanoid shark fighter driven by the shared GLB mesh.
 * Attack / crouch / block / hitstun are procedural poses on the body group.
 */
export class Fighter {
  readonly name: string;
  readonly stats: Stats;
  readonly isPlayer: boolean;
  readonly mesh: THREE.Group;
  readonly maxHealth: number;
  health: number;
  chipHealth: number;
  meter = 0;
  readonly maxMeter = 100;
  x: number;
  y = 0;
  vy = 0;
  facing: 1 | -1;
  crouching = false;
  grounded = true;
  hitstun = 0;
  attackCooldown = 0;
  attackActive = 0;
  attackKind: AttackKind = null;
  blocking = false;
  dead = false;
  flash = 0;

  private body: THREE.Group;
  private materials: THREE.MeshStandardMaterial[];
  private accent: number;
  private speed: number;
  private rate: number;
  private animT = 0;
  /** Full length of the current attack window (for 0→1 progress). */
  private attackDuration = 0;
  private moveDx = 0;

  constructor(opts: FighterOpts) {
    this.name = opts.name;
    this.stats = opts.stats;
    this.isPlayer = opts.isPlayer;
    this.facing = opts.facing;
    this.x = opts.x;
    this.maxHealth = maxHp(opts.stats);
    this.health = this.maxHealth;
    this.chipHealth = this.maxHealth;
    this.speed = moveSpeed(opts.stats);
    this.rate = attackRate(opts.stats);

    this.mesh = new THREE.Group();
    this.body = new THREE.Group();

    const { root, materials, accent } = cloneSharkFighter(opts.color, opts.accent);
    this.materials = materials;
    this.accent = accent;
    this.body.add(root);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;

    this.mesh.add(this.body, shadow);
    this.mesh.position.set(this.x, 0, 0);
    this.syncMesh();
  }

  get hitbox(): { x: number; y: number; w: number; h: number } {
    const h = this.crouching ? 1.15 : 1.95;
    const y = this.crouching ? 0.05 : 0.1;
    return { x: this.x - 0.38, y: this.y + y, w: 0.76, h };
  }

  get attackBox(): { x: number; y: number; w: number; h: number } | null {
    if (this.attackActive <= 0 || !this.attackKind) return null;
    const reach =
      this.attackKind === "light" ? 0.95 : this.attackKind === "heavy" ? 1.15 : 1.45;
    const h = this.crouching ? 0.55 : 0.7;
    const y = this.y + (this.crouching ? 0.4 : 1.15);
    const x = this.facing === 1 ? this.x + 0.25 : this.x - 0.25 - reach;
    return { x, y, w: reach, h };
  }

  faceToward(otherX: number): void {
    this.facing = otherX >= this.x ? 1 : -1;
  }

  takeHit(dmg: number, knock: number, fromFacing: 1 | -1): void {
    if (this.dead) return;
    if (this.blocking) {
      dmg *= 0.25;
      knock *= 0.35;
      this.meter = Math.min(this.maxMeter, this.meter + 4);
    } else {
      this.hitstun = dmg > 18 ? 0.48 : 0.3;
      this.attackActive = 0;
      this.attackKind = null;
      this.flash = 0.12;
    }
    this.health = Math.max(0, this.health - dmg);
    this.x += fromFacing * knock;
    this.meter = Math.min(this.maxMeter, this.meter + meterGain(this.stats) * 0.35);
    if (this.health <= 0) this.dead = true;
  }

  tryAttack(kind: Exclude<AttackKind, null>): boolean {
    if (this.dead || this.hitstun > 0 || this.attackCooldown > 0 || this.attackActive > 0) {
      return false;
    }
    if (kind === "special" && this.meter < 50) return false;
    this.attackKind = kind;
    // Slightly longer windows so each attack reads as its own animation.
    const dur =
      kind === "light" ? 0.28 / this.rate : kind === "heavy" ? 0.48 / this.rate : 0.62;
    this.attackDuration = dur;
    this.attackActive = dur;
    this.attackCooldown =
      kind === "light" ? 0.36 / this.rate : kind === "heavy" ? 0.7 / this.rate : 0.9;
    if (kind === "special") this.meter -= 50;
    return true;
  }

  /** 0 at start → 1 at end of the active attack. */
  private attackProgress(): number {
    if (this.attackActive <= 0 || this.attackDuration <= 0) return 0;
    return 1 - THREE.MathUtils.clamp(this.attackActive / this.attackDuration, 0, 1);
  }

  damageFor(kind: Exclude<AttackKind, null>): number {
    if (kind === "light") return lightDamage(this.stats);
    if (kind === "heavy") return heavyDamage(this.stats);
    return specialDamage(this.stats);
  }

  knockFor(kind: Exclude<AttackKind, null>): number {
    if (kind === "light") return 0.35;
    if (kind === "heavy") return 0.7;
    return 1.1;
  }

  updatePlayer(dt: number, input: InputState, walls: { left: number; right: number }): void {
    if (this.dead) return;
    this.tickTimers(dt);
    if (this.hitstun > 0) {
      this.syncMesh();
      return;
    }

    const holdingBack =
      (this.facing === 1 && input.left) || (this.facing === -1 && input.right);
    this.blocking = holdingBack && !input.light && !input.heavy && !input.special;
    this.crouching = input.down && this.grounded && !this.blocking;

    if (this.attackActive <= 0) {
      let dx = 0;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      this.moveDx = dx;
      if (!this.blocking && !this.crouching) this.x += dx * this.speed * dt;
      else if (this.crouching) this.x += dx * this.speed * 0.35 * dt;
      if (input.up && this.grounded) {
        this.vy = 7.2 + this.stats.dex * 0.04;
        this.grounded = false;
      }
      if (input.light) this.tryAttack("light");
      else if (input.heavy) this.tryAttack("heavy");
      else if (input.special) this.tryAttack("special");
    } else {
      this.moveDx = 0;
    }

    this.applyPhysics(dt, walls);
    this.syncMesh();
  }

  updateAI(dt: number, target: Fighter, walls: { left: number; right: number }): void {
    if (this.dead) return;
    this.tickTimers(dt);
    if (this.hitstun > 0) {
      this.syncMesh();
      return;
    }

    const dist = Math.abs(target.x - this.x);
    this.blocking = dist < 1.4 && Math.random() < 0.012;
    this.crouching = false;

    if (this.attackActive <= 0) {
      const dir = target.x > this.x ? 1 : -1;
      this.moveDx = dist > 1.5 ? dir : dist < 0.9 ? -dir : 0;
      if (dist > 1.5) this.x += dir * this.speed * 0.85 * dt;
      else if (dist < 0.9) this.x -= dir * this.speed * 0.5 * dt;
      if (this.grounded && Math.random() < 0.4 * dt) {
        this.vy = 6.8;
        this.grounded = false;
      }
      if (dist < 1.8 && this.attackCooldown <= 0) {
        const roll = Math.random();
        if (this.meter >= 50 && roll > 0.82) this.tryAttack("special");
        else if (roll > 0.55) this.tryAttack("heavy");
        else this.tryAttack("light");
      }
    } else {
      this.moveDx = 0;
    }

    this.applyPhysics(dt, walls);
    this.syncMesh();
  }

  private tickTimers(dt: number): void {
    this.animT += dt;
    if (this.hitstun > 0) this.hitstun -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.chipHealth > this.health) {
      this.chipHealth = Math.max(this.health, this.chipHealth - this.maxHealth * dt * 0.55);
    } else {
      this.chipHealth = this.health;
    }
    if (this.attackActive > 0) {
      this.attackActive -= dt;
      if (this.attackActive <= 0) this.attackKind = null;
    }
  }

  private applyPhysics(dt: number, walls: { left: number; right: number }): void {
    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }
    this.x = THREE.MathUtils.clamp(this.x, walls.left, walls.right);
  }

  private syncMesh(): void {
    const crouch = this.crouching ? 1 : 0;
    const walkPhase = this.animT * (this.moveDx !== 0 ? 10 : 4.2);
    const idleBob = Math.sin(walkPhase) * (this.moveDx !== 0 ? 0.06 : 0.03);
    let bodyY = THREE.MathUtils.lerp(0, -0.38, crouch) + (this.grounded ? idleBob : 0);
    let rotX = THREE.MathUtils.lerp(0, 0.48, crouch);
    let rotY = 0;
    let rotZ = this.moveDx !== 0 && !this.crouching ? Math.sin(walkPhase) * 0.08 : 0;
    let lunge = 0;
    let squashY = 1;
    let squashZ = 1;

    if (this.blocking) {
      rotX = 0.22;
      rotY = -0.35;
      bodyY += 0.02;
      lunge = -0.12;
      squashZ = 0.92;
    } else if (this.attackActive > 0 && this.attackKind) {
      const pose = this.poseForAttack(this.attackKind, this.attackProgress());
      bodyY += pose.bodyY;
      rotX += pose.rotX;
      rotY += pose.rotY;
      rotZ += pose.rotZ;
      lunge = pose.lunge;
      squashY = pose.squashY;
      squashZ = pose.squashZ;
    } else if (this.hitstun > 0) {
      const t = Math.min(1, this.hitstun * 3);
      rotX = 0.35 * t;
      rotZ = 0.55 * t;
      lunge = -0.2 * t;
      bodyY += 0.08 * t;
      squashY = 1 + 0.08 * t;
    } else if (this.dead) {
      rotZ = 1.2;
      bodyY = -0.15;
      lunge = -0.35;
    }

    if (!this.grounded && !(this.attackActive > 0 && this.attackKind === "special")) {
      rotX -= 0.28;
      bodyY += 0.06;
      squashY = 1.06;
      squashZ = 0.94;
    }

    // Local +X is toward the opponent after normalize; scale.x mirrors for facing -1.
    this.body.position.set(lunge, bodyY, 0);
    this.body.rotation.set(rotX, rotY, rotZ);
    this.body.scale.set(1, squashY, squashZ);

    const hitFlash = this.flash > 0;
    for (const mat of this.materials) {
      if (hitFlash) {
        mat.emissive.setHex(this.accent);
        mat.emissiveIntensity = 0.85;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }

    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.scale.set(this.facing, 1, 1);
  }

  /**
   * Distinct procedural attack arcs on the rigid shark mesh.
   * Progress 0 = windup, ~0.45 = impact, 1 = recovery.
   */
  private poseForAttack(
    kind: Exclude<AttackKind, null>,
    p: number,
  ): {
    bodyY: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    lunge: number;
    squashY: number;
    squashZ: number;
  } {
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
    const easeIn = (t: number) => t * t;
    const pulse = (t: number, peak = 0.45) => {
      if (t <= peak) return easeIn(t / peak);
      return 1 - easeOut((t - peak) / (1 - peak));
    };

    if (kind === "light") {
      // Quick jab: short lean + snap lunge, little airtime.
      const hit = pulse(p, 0.4);
      const wind = p < 0.25 ? easeIn(p / 0.25) : 1 - (p - 0.25) / 0.75;
      return {
        bodyY: 0.02 * hit,
        rotX: -0.55 * hit + 0.15 * Math.max(0, wind),
        rotY: 0.15 * hit,
        rotZ: 0.35 * hit,
        lunge: 0.55 * hit - 0.12 * Math.max(0, 1 - p * 4),
        squashY: 1 - 0.06 * hit,
        squashZ: 1 + 0.1 * hit,
      };
    }

    if (kind === "heavy") {
      // Haymaker / shoulder check: big windup lean back, then crash forward.
      const wind = p < 0.35 ? easeIn(p / 0.35) : Math.max(0, 1 - (p - 0.35) / 0.2);
      const hit = p < 0.35 ? 0 : pulse((p - 0.35) / 0.65, 0.35);
      return {
        bodyY: 0.04 * wind + 0.1 * hit,
        rotX: 0.55 * wind - 0.75 * hit,
        rotY: -0.2 * wind + 0.25 * hit,
        rotZ: -0.15 * wind + 0.55 * hit,
        lunge: -0.28 * wind + 0.85 * hit,
        squashY: 1 + 0.08 * wind - 0.12 * hit,
        squashZ: 1 - 0.05 * wind + 0.14 * hit,
      };
    }

    // Special: rising spin slam — hop, full Y spin, stomp.
    const lift = p < 0.55 ? pulse(p / 0.55, 0.5) : 0;
    const spin = p < 0.7 ? easeOut(p / 0.7) : 1;
    const stomp = p < 0.55 ? 0 : pulse((p - 0.55) / 0.45, 0.35);
    return {
      bodyY: 0.55 * lift - 0.12 * stomp,
      rotX: -0.4 * lift + 0.5 * stomp,
      rotY: Math.PI * 2 * spin,
      rotZ: 0.25 * Math.sin(spin * Math.PI * 2),
      lunge: 0.25 * lift + 0.7 * stomp,
      squashY: 1 + 0.12 * lift - 0.18 * stomp,
      squashZ: 1 - 0.08 * lift + 0.16 * stomp,
    };
  }
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
