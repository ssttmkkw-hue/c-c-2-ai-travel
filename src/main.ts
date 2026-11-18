/**
 * 入口：组装各系统。新增系统（UI、音效、存档...）在这里挂载，系统之间用 bus 通信。
 */
import '@/core/ui'; // 按键路由必须最先注册（见 core/ui.ts）
import { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import { World } from '@/world/World';
import { Player } from '@/player/Player';
import { MAP_CARDS } from '@/world/registry';
import { mountNpcBubble } from '@/npc/bubble';
import { mountDebugHud } from '@/ui/debugHud';
import { mountDialogue } from '@/ui/dialogue';
import { mountHud } from '@/ui/hud';
import { mountPassport } from '@/ui/passport';
import { mountUiScale } from '@/ui/scale';
import { mountSettings } from '@/ui/settings';
import { mountTransition } from '@/ui/transition';
import { mountWardrobe } from '@/ui/wardrobe';

const engine = new Engine(document.getElementById('app')!);
const world = new World(engine);
const player = new Player(engine, world);
const ui = document.getElementById('ui')!;
mountUiScale(ui); // 先定好 UI 缩放，后面挂载的界面量尺寸时才准
mountSettings(ui);
mountHud(ui);
const dialogue = mountDialogue(ui);
mountPassport(ui);
mountTransition(ui);
mountWardrobe(ui);
mountNpcBubble(ui, engine, world);
mountDebugHud(ui);

// 开发调试用：仅 dev 模式下在控制台暴露 __game。需要调试的对象都加在这里，不要另开全局变量
if (import.meta.env.DEV) (window as any).__game = { engine, world, player, bus, dialogue };

bus.emit('map:request', { id: MAP_CARDS[0].id });
engine.start();
