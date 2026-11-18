/**
 * Q 版角色：Group 关节 + 程序动画。玩家与 NPC 共用。
 * 面朝 -Z，原点在脚底。身高约 1.2m，头宽约为躯干的 1.3 倍。
 */
import * as THREE from 'three';
import * as kit from '@/art/kit';
import { COLORS } from '@/art/colors';
import { toonMaterial } from '@/render/toon';
import type { AvatarRig } from './types';
import { getOutfit } from './outfits';

const SKIN = COLORS.skin[0];
const HAIR = COLORS.woodDark;
const EYE = COLORS.black;
const SHOE = COLORS.black;

const HIP_Y = 0.44;

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function joint(x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}

export function createChibiAvatar(outfitId: string): AvatarRig {
  const root = new THREE.Group();
  const hips = joint(0, HIP_Y, 0);

  const torso = joint();
  const torsoMesh = kit.box(0.4, 0.36, 0.26, '#ffffff', { y: 0.2 });
  torso.add(torsoMesh);

  const head = joint(0, 0.34, 0);
  const headMesh = kit.box(0.52, 0.38, 0.44, SKIN, { y: 0.18 });
  const hairCap = kit.box(0.54, 0.14, 0.46, HAIR, { y: 0.32 });
  const bangs = kit.box(0.5, 0.1, 0.1, HAIR, { y: 0.26, z: -0.18 });
  const sideL = kit.box(0.12, 0.3, 0.42, HAIR, { x: -0.24, y: 0.15, z: 0.03 });
  const sideR = kit.box(0.12, 0.3, 0.42, HAIR, { x: 0.24, y: 0.15, z: 0.03 });
  const hairBack = kit.box(0.46, 0.3, 0.14, HAIR, { y: 0.15, z: 0.2 });
  const eyeL = kit.box(0.09, 0.1, 0.04, EYE, { x: -0.12, y: 0.18, z: -0.22, outline: false });
  const eyeR = kit.box(0.09, 0.1, 0.04, EYE, { x: 0.12, y: 0.18, z: -0.22, outline: false });
  const hat = kit.box(0.56, 0.07, 0.48, '#ffffff', { y: 0.4 });
  head.add(headMesh, hairCap, bangs, sideL, sideR, hairBack, eyeL, eyeR, hat);

  const armL = joint(-0.26, 0.32, 0);
  const upperArmL = kit.box(0.12, 0.2, 0.12, SKIN, { y: -0.1 });
  const elbowL = joint(0, -0.2, 0);
  const foreArmL = kit.box(0.11, 0.18, 0.11, SKIN, { y: -0.09 });
  const handL = kit.ball(0.06, SKIN, { y: -0.2, outline: false, shadow: false });
  elbowL.add(foreArmL, handL);
  const sleeveL = kit.box(0.15, 0.16, 0.15, '#ffffff', { y: -0.08 });
  armL.add(upperArmL, sleeveL, elbowL);

  const armR = joint(0.26, 0.32, 0);
  const upperArmR = kit.box(0.12, 0.2, 0.12, SKIN, { y: -0.1 });
  const elbowR = joint(0, -0.2, 0);
  const foreArmR = kit.box(0.11, 0.18, 0.11, SKIN, { y: -0.09 });
  const handR = kit.ball(0.06, SKIN, { y: -0.2, outline: false, shadow: false });
  elbowR.add(foreArmR, handR);
  const sleeveR = kit.box(0.15, 0.16, 0.15, '#ffffff', { y: -0.08 });
  armR.add(upperArmR, sleeveR, elbowR);

  torso.add(head, armL, armR);

  const legL = joint(-0.1, 0, 0);
  const thighL = kit.box(0.15, 0.24, 0.16, '#ffffff', { y: -0.12 });
  const kneeL = joint(0, -0.24, 0);
  const shinL = kit.box(0.13, 0.16, 0.14, '#ffffff', { y: -0.08 });
  const shoeL = kit.box(0.15, 0.08, 0.2, SHOE, { y: -0.2, z: -0.02 });
  kneeL.add(shinL, shoeL);
  legL.add(thighL, kneeL);

  const legR = joint(0.1, 0, 0);
  const thighR = kit.box(0.15, 0.24, 0.16, '#ffffff', { y: -0.12 });
  const kneeR = joint(0, -0.24, 0);
  const shinR = kit.box(0.13, 0.16, 0.14, '#ffffff', { y: -0.08 });
  const shoeR = kit.box(0.15, 0.08, 0.2, SHOE, { y: -0.2, z: -0.02 });
  kneeR.add(shinR, shoeR);
  legR.add(thighR, kneeR);

  hips.add(torso, legL, legR);
  root.add(hips);

  const tops: THREE.Mesh[] = [torsoMesh, sleeveL, sleeveR];
  const bottoms: THREE.Mesh[] = [thighL, thighR, shinL, shinR];

  let phase = 0;
  let breath = 0;
  let blinkTimer = 1.6 + Math.random();
  let blinkLeft = 0;
  let eyeOpen = 1;
  let lean = 0;
  let bob = 0;
  let armOut = 0;

  const rig: AvatarRig = {
    root,
    head,
    animate(dt, speed, airborne) {
      const walk = THREE.MathUtils.clamp(speed / 4, 0, 1);
      const run = THREE.MathUtils.clamp((speed - 4) / 3.5, 0, 1);
      const airT = airborne ? 1 : 0;
      phase += dt * (7.2 + run * 3.4) * walk;
      breath += dt;

      const swing = Math.sin(phase);
      const lift = Math.abs(Math.sin(phase));
      const ground = 1 - airT;

      const legAmp = (0.5 + run * 0.42) * walk * ground;
      const armAmp = (0.42 + run * 0.38) * walk * ground;
      const bobT = lift * (0.03 + run * 0.04) * walk * ground;
      const breathY = Math.sin(breath * 2.1) * 0.014 * (1 - walk * 0.85) * ground;
      const leanT = (0.06 * walk + 0.26 * run) * ground;

      bob = damp(bob, bobT, 10, dt);
      lean = damp(lean, leanT, 6, dt);
      armOut = damp(armOut, airT, 8, dt);
      hips.position.y = HIP_Y + bob + breathY;
      torso.rotation.x = lean;
      torso.rotation.z = damp(torso.rotation.z, swing * 0.05 * walk * ground, 8, dt);

      const tuck = armOut;
      legL.rotation.x = damp(legL.rotation.x, swing * legAmp + tuck * 0.95, 12, dt);
      legR.rotation.x = damp(legR.rotation.x, -swing * legAmp + tuck * 0.95, 12, dt);
      kneeL.rotation.x = damp(kneeL.rotation.x, -Math.max(-swing, 0) * 0.7 * walk * ground - tuck * 1.25, 12, dt);
      kneeR.rotation.x = damp(kneeR.rotation.x, -Math.max(swing, 0) * 0.7 * walk * ground - tuck * 1.25, 12, dt);

      armL.rotation.x = damp(armL.rotation.x, -swing * armAmp * ground, 10, dt);
      armR.rotation.x = damp(armR.rotation.x, swing * armAmp * ground, 10, dt);
      armL.rotation.z = damp(armL.rotation.z, -tuck * 1.15, 8, dt);
      armR.rotation.z = damp(armR.rotation.z, tuck * 1.15, 8, dt);
      elbowL.rotation.x = damp(elbowL.rotation.x, -0.25 * Math.max(swing, 0) * walk * ground, 10, dt);
      elbowR.rotation.x = damp(elbowR.rotation.x, -0.25 * Math.max(-swing, 0) * walk * ground, 10, dt);

      blinkTimer -= dt;
      if (blinkTimer <= 0 && blinkLeft <= 0) {
        blinkLeft = 0.12;
        blinkTimer = 2.6 + Math.random() * 2.4;
      }
      if (blinkLeft > 0) blinkLeft -= dt;
      const eyeT = blinkLeft > 0 ? 0.12 : 1;
      eyeOpen = damp(eyeOpen, eyeT, 28, dt);
      eyeL.scale.y = eyeOpen;
      eyeR.scale.y = eyeOpen;
    },
    setOutfit(id) {
      const o = getOutfit(id);
      const topMat = toonMaterial(o.colors.top);
      const bottomMat = toonMaterial(o.colors.bottom);
      const hatMat = toonMaterial(o.colors.hat ?? o.colors.top);
      for (const m of tops) m.material = topMat;
      for (const m of bottoms) m.material = bottomMat;
      hat.material = hatMat;

      for (const child of [...head.children]) {
        if (child.userData.accessory) head.remove(child);
      }
      if (o.buildAccessory) {
        const acc = o.buildAccessory();
        acc.userData.accessory = true;
        head.add(acc);
      }
    },
  };

  rig.setOutfit(outfitId);
  return rig;
}
