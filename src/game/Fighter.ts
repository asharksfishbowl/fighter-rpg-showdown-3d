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
  private speed: number;
  private rate: number;
  private animT = 0;
  private baseEmissive: number[] = [];

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

    const { root, materials } = cloneSharkFighter(opts.color, opts.accent);
    this.materials = materials;
    this.baseEmissive = materials.map((m) => m.emissiveIntensity);
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
    const dur =
      kind === "light" ? 0.16 / this.rate : kind === "heavy" ? 0.28 / this.rate : 0.34;
    this.attackActive = dur;
    this.attackCooldown =
      kind === "light" ? 0.28 / this.rate : kind === "heavy" ? 0.55 / this.rate : 0.7;
    if (kind === "special") this.meter -= 50;
    return true;
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
      if (!this.blocking && !this.crouching) this.x += dx * this.speed * dt;
      else if (this.crouching) this.x += dx * this.speed * 0.35 * dt;
      if (input.up && this.grounded) {
        this.vy = 7.2 + this.stats.dex * 0.04;
        this.grounded = false;
      }
      if (input.light) this.tryAttack("light");
      else if (input.heavy) this.tryAttack("heavy");
      else if (input.special) this.tryAttack("special");
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
    const idleBob = Math.sin(this.animT * 4.2) * 0.03;
    let bodyY = THREE.MathUtils.lerp(0, -0.35, crouch) + (this.grounded ? idleBob : 0);
    let rotX = THREE.MathUtils.lerp(0, 0.45, crouch);
    let rotZ = 0;
    let rotY = 0;
    let lunge = 0;

    if (this.blocking) {
      rotX = 0.15;
      rotY = -0.25 * this.facing;
      bodyY += 0.02;
    } else if (this.attackActive > 0 && this.attackKind) {
      const punch =
        this.attackKind === "special" ? 0.55 : this.attackKind === "heavy" ? 0.42 : 0.28;
      lunge = punch;
      rotX = -0.35;
      rotZ = this.attackKind === "special" ? 0.2 : 0.08;
    } else if (this.hitstun > 0) {
      rotX = 0.2;
      rotZ = 0.35;
      bodyY += 0.05;
    }

    if (!this.grounded) {
      rotX -= 0.25;
      bodyY += 0.05;
    }

    this.body.position.set(lunge * this.facing, bodyY, 0);
    this.body.rotation.set(rotX, rotY, rotZ);

    const hitFlash = this.flash > 0;
    for (let i = 0; i < this.materials.length; i++) {
      const mat = this.materials[i]!;
      mat.emissiveIntensity = hitFlash ? 1.35 : this.baseEmissive[i] ?? 0.42;
    }

    this.mesh.position.set(this.x, this.y, 0);
    // Mirror for facing — humanoid shark reads correctly flipped on X.
    this.mesh.scale.set(this.facing, 1, 1);
  }
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
