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
import { mountSettings } from '@/ui/settings';

const engine = new Engine(document.getElementById('app')!);
const world = new World(engine);
const player = new Player(engine, world);
const ui = document.getElementById('ui')!;
mountDebugHud(ui);
// TODO(T12)：UI 改用 core/ui.ts 的 keys.bind 后，挂载顺序就不再重要，下面两段注释可删
// 对话框的捕获监听必须先于设置和护照注册，打开时才能用 stopImmediatePropagation
// 拦住 P / Tab / M（这两处面板不看 dialogue 的 ui:modal）。
const dialogue = mountDialogue(ui);
// HUD / 设置要先于护照挂载，才能接到开局护照发出的 ui:modal。
// 两者也会在下一微任务里再对一下已打开的弹层，挂反了也不会丢初始状态。
mountHud(ui);
mountSettings(ui);
mountPassport(ui);
mountNpcBubble(ui, engine, world);

// 开发调试用：仅 dev 模式下在控制台暴露 __game。需要调试的对象都加在这里，不要另开全局变量
if (import.meta.env.DEV) (window as any).__game = { engine, world, player, bus, dialogue };

bus.emit('map:request', { id: MAP_CARDS[0].id });
engine.start();
