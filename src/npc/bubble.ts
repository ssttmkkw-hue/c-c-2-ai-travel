/**
 * 附近 NPC 头顶的像素气泡。用 HTML 叠在画面上，每帧投影世界坐标。
 */
import * as THREE from 'three';
import type { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import type { World } from '@/world/World';

const HEAD = 1.55;
const proj = new THREE.Vector3();

export function mountNpcBubble(root: HTMLElement, engine: Engine, world: World): void {
  const el = document.createElement('div');
  el.className = 'npc-bubble';
  el.textContent = '💬';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  root.appendChild(el);

  let nearby: string | null = null;
  let dialogueOpen = false;

  bus.on('npc:nearby', ({ npcId }) => {
    nearby = npcId;
  });
  bus.on('ui:modal', ({ id, open }) => {
    if (id === 'dialogue') dialogueOpen = open;
  });

  const style = document.createElement('style');
  style.textContent = `
    #ui > .npc-bubble {
      pointer-events: none;
      position: absolute;
      z-index: 2;
      margin: 0;
      padding: 2px 4px;
      font-size: 14px;
      line-height: 1;
      background: var(--ui-paper);
      border: var(--ui-border);
      transform: translate(-50%, -120%);
    }
    #ui > .npc-bubble[hidden] { display: none; }
  `;
  document.head.appendChild(style);

  engine.onUpdate(() => {
    if (!nearby || dialogueOpen) {
      el.hidden = true;
      return;
    }
    const npc = world.npcs.find((n) => n.id === nearby);
    if (!npc) {
      el.hidden = true;
      return;
    }
    proj.set(npc.object.position.x, npc.object.position.y + HEAD, npc.object.position.z);
    proj.project(engine.camera);
    if (proj.z > 1) {
      el.hidden = true;
      return;
    }
    const x = (proj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-proj.y * 0.5 + 0.5) * window.innerHeight;
    el.hidden = false;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });
}
