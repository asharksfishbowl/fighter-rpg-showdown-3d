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

export class Fighter {
  readonly name: string;
  readonly stats: Stats;
  readonly isPlayer: boolean;
  readonly mesh: THREE.Group;
  readonly maxHealth: number;
  health: number;
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

  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private fist: THREE.Mesh;
  private speed: number;
  private rate: number;

  constructor(opts: FighterOpts) {
    this.name = opts.name;
    this.stats = opts.stats;
    this.isPlayer = opts.isPlayer;
    this.facing = opts.facing;
    this.x = opts.x;
    this.maxHealth = maxHp(opts.stats);
    this.health = this.maxHealth;
    this.speed = moveSpeed(opts.stats);
    this.rate = attackRate(opts.stats);

    this.mesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: opts.accent,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.25,
    });
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 10), mat);
    this.body.position.y = 1.0;
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffe0c8,
        roughness: 0.6,
      }),
    );
    this.head.position.y = 1.85;
    this.fist = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshStandardMaterial({
        color: opts.accent,
        emissive: opts.accent,
        emissiveIntensity: 0.6,
      }),
    );
    this.fist.position.set(0.45 * opts.facing, 1.1, 0.2);
    this.mesh.add(this.body, this.head, this.fist);
    this.mesh.position.set(this.x, 0, 0);
  }

  get hitbox(): { x: number; y: number; w: number; h: number } {
    const h = this.crouching ? 1.1 : 1.9;
    const y = this.crouching ? 0.05 : 0.15;
    return { x: this.x - 0.35, y: this.y + y, w: 0.7, h };
  }

  get attackBox(): { x: number; y: number; w: number; h: number } | null {
    if (this.attackActive <= 0 || !this.attackKind) return null;
    const reach =
      this.attackKind === "light" ? 0.85 : this.attackKind === "heavy" ? 1.05 : 1.35;
    const h = this.crouching ? 0.55 : 0.65;
    const y = this.y + (this.crouching ? 0.35 : 1.05);
    const x =
      this.facing === 1 ? this.x + 0.2 : this.x - 0.2 - reach;
    return { x, y, w: reach, h };
  }

  faceToward(otherX: number): void {
    this.facing = otherX >= this.x ? 1 : -1;
    this.mesh.scale.x = this.facing;
  }

  takeHit(dmg: number, knock: number, fromFacing: 1 | -1): void {
    if (this.dead) return;
    if (this.blocking) {
      dmg *= 0.25;
      knock *= 0.35;
      this.meter = Math.min(this.maxMeter, this.meter + 4);
    } else {
      this.hitstun = this.attackKind === "heavy" || dmg > 18 ? 0.45 : 0.28;
      this.attackActive = 0;
      this.attackKind = null;
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

    // Classic: hold back relative to opponent to block
    const holdingBack =
      (this.facing === 1 && input.left) || (this.facing === -1 && input.right);
    this.blocking = holdingBack && !input.light && !input.heavy && !input.special;
    this.crouching = input.down && this.grounded && !this.blocking;

    if (this.attackActive <= 0) {
      let dx = 0;
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (!this.blocking && !this.crouching) {
        this.x += dx * this.speed * dt;
      } else if (this.crouching) {
        this.x += dx * this.speed * 0.35 * dt;
      }
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

  updateAI(
    dt: number,
    target: Fighter,
    walls: { left: number; right: number },
  ): void {
    if (this.dead) return;
    this.tickTimers(dt);
    if (this.hitstun > 0) {
      this.syncMesh();
      return;
    }

    const dist = Math.abs(target.x - this.x);
    this.blocking = dist < 1.4 && Math.random() < 0.35 * dt * 60 * 0.02;
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
    if (this.hitstun > 0) this.hitstun -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
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
    const crouchScale = this.crouching ? 0.72 : 1;
    this.body.scale.y = crouchScale;
    this.body.position.y = this.crouching ? 0.75 : 1.0;
    this.head.position.y = this.crouching ? 1.35 : 1.85;
    const punch =
      this.attackActive > 0
        ? this.attackKind === "special"
          ? 0.95
          : this.attackKind === "heavy"
            ? 0.75
            : 0.55
        : 0.35;
    this.fist.position.set(punch, this.crouching ? 0.85 : 1.1, 0.2);
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.scale.x = this.facing;
  }
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
