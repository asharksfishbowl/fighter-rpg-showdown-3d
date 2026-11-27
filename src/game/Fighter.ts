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

type Limb = {
  root: THREE.Group;
  mesh: THREE.Object3D;
};

/**
 * Street-fighter-ish humanoid: torso, headband, limbs, fighting stance.
 * Procedural meshes — no external assets.
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

  private torso: THREE.Group;
  private head: THREE.Group;
  private frontArm: Limb;
  private backArm: Limb;
  private frontLeg: Limb;
  private backLeg: Limb;
  private speed: number;
  private rate: number;
  private suit: THREE.MeshStandardMaterial;
  private accentMat: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;

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

    this.suit = new THREE.MeshStandardMaterial({
      color: opts.color,
      emissive: opts.accent,
      emissiveIntensity: 0.22,
      roughness: 0.4,
      metalness: 0.2,
    });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: opts.accent,
      emissive: opts.accent,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.35,
    });
    this.skinMat = new THREE.MeshStandardMaterial({
      color: 0xe8b896,
      roughness: 0.65,
      metalness: 0.05,
    });

    this.mesh = new THREE.Group();
    this.torso = new THREE.Group();
    this.torso.position.y = 1.15;

    const chest = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.55, 6, 12),
      this.suit,
    );
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.06, 8, 20),
      this.accentMat,
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.y = -0.35;
    const shoulders = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.18, 0.35),
      this.suit,
    );
    shoulders.position.y = 0.28;
    this.torso.add(chest, belt, shoulders);

    this.head = new THREE.Group();
    this.head.position.y = 0.72;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), this.skinMat);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 }),
    );
    hair.position.y = 0.06;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.045, 8, 24),
      this.accentMat,
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.02;
    this.head.add(skull, hair, band);
    this.torso.add(this.head);

    this.frontArm = this.makeLimb(0.14, 0.7, this.skinMat, true);
    this.backArm = this.makeLimb(0.14, 0.7, this.skinMat, true);
    this.frontArm.root.position.set(0.42, 0.25, 0.08);
    this.backArm.root.position.set(-0.42, 0.25, -0.05);
    this.torso.add(this.frontArm.root, this.backArm.root);

    this.frontLeg = this.makeLimb(0.16, 0.85, this.suit, false);
    this.backLeg = this.makeLimb(0.16, 0.85, this.suit, false);
    this.frontLeg.root.position.set(0.16, -0.45, 0.06);
    this.backLeg.root.position.set(-0.16, -0.45, -0.04);
    this.torso.add(this.frontLeg.root, this.backLeg.root);

    // Shadow disc
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

    this.mesh.add(this.torso, shadow);
    this.mesh.position.set(this.x, 0, 0);
    this.syncMesh();
  }

  private makeLimb(
    radius: number,
    length: number,
    mat: THREE.Material,
    withFist: boolean,
  ): Limb {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, length * 0.7, 4, 10),
      mat,
    );
    mesh.position.y = -length * 0.45;
    root.add(mesh);
    if (withFist) {
      const fist = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 1.6, radius * 1.6, radius * 1.8),
        this.accentMat,
      );
      fist.position.y = -length * 0.95;
      root.add(fist);
    } else {
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 2.2, radius * 1.1, radius * 3.2),
        this.accentMat,
      );
      boot.position.set(0, -length * 0.95, radius * 0.6);
      root.add(boot);
    }
    return { root, mesh };
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
    if (this.hitstun > 0) this.hitstun -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.flash > 0) this.flash -= dt;
    // Trailing chip bar eases toward real HP (SF two-layer drain)
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
    this.torso.position.y = THREE.MathUtils.lerp(1.15, 0.78, crouch);
    this.torso.rotation.x = THREE.MathUtils.lerp(0, 0.35, crouch);

    // Fighting stance
    let frontArmX = 1.1;
    let frontArmZ = -0.35;
    let backArmX = 0.85;
    let backArmZ = 0.45;
    let frontLegX = 0.15;
    let backLegX = -0.25;

    if (this.blocking) {
      frontArmX = 0.4;
      frontArmZ = -1.2;
      backArmX = 0.55;
      backArmZ = -1.0;
    } else if (this.attackActive > 0 && this.attackKind) {
      const punch =
        this.attackKind === "special" ? 1.6 : this.attackKind === "heavy" ? 1.35 : 1.15;
      frontArmX = -0.2;
      frontArmZ = -punch;
      if (this.attackKind === "heavy" || this.attackKind === "special") {
        frontLegX = -0.6;
        backLegX = 0.35;
      }
    } else if (this.hitstun > 0) {
      frontArmX = 1.4;
      backArmX = 1.2;
      this.torso.rotation.z = 0.25;
    } else {
      this.torso.rotation.z = 0;
    }

    this.frontArm.root.rotation.set(frontArmX, 0, frontArmZ);
    this.backArm.root.rotation.set(backArmX, 0, backArmZ);
    this.frontLeg.root.rotation.set(frontLegX, 0, 0.08);
    this.backLeg.root.rotation.set(backLegX, 0, -0.08);

    if (!this.grounded) {
      this.frontLeg.root.rotation.x = -0.8;
      this.backLeg.root.rotation.x = 0.5;
    }

    const hitFlash = this.flash > 0;
    this.suit.emissiveIntensity = hitFlash ? 0.9 : 0.22;
    this.accentMat.emissiveIntensity = hitFlash ? 1.2 : 0.55;

    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.scale.x = this.facing;
    this.mesh.scale.y = 1;
    this.mesh.scale.z = 1;
  }
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
