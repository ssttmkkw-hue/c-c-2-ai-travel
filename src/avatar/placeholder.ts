/** 占位角色：几个方块拼的小人 + 最简单的摆腿动画。T03 会替换掉。 */
import * as THREE from 'three';
import * as kit from '@/art/kit';
import type { AvatarRig } from './types';
import { getOutfit } from './outfits';
import { toonMaterial } from '@/render/toon';

export function createPlaceholderAvatar(outfitId: string): AvatarRig {
  const root = new THREE.Group();
  const body = kit.box(0.5, 0.45, 0.32, '#ffffff', { y: 0.55 });
  const legL = kit.box(0.18, 0.35, 0.2, '#ffffff', { x: -0.12, y: 0.17 });
  const legR = kit.box(0.18, 0.35, 0.2, '#ffffff', { x: 0.12, y: 0.17 });
  const head = kit.box(0.55, 0.5, 0.5, '#ffe0c8', { y: 1.0 });
  const hat = kit.box(0.6, 0.12, 0.55, '#ffffff', { y: 0.3 });
  head.add(hat);
  root.add(body, legL, legR, head);

  let phase = 0;
  const rig: AvatarRig = {
    root,
    head,
    torso: body,
    animate(dt, speed, airborne) {
      phase += dt * speed * 3;
      const swing = airborne ? 0.5 : Math.sin(phase) * Math.min(speed / 3, 1) * 0.6;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
    },
    setOutfit(id) {
      const o = getOutfit(id);
      body.material = toonMaterial(o.colors.top);
      legL.material = legR.material = toonMaterial(o.colors.bottom);
      hat.material = toonMaterial(o.colors.hat ?? o.colors.top);
    },
  };
  rig.setOutfit(outfitId);
  return rig;
}
