/**
 * 入口：组装各系统。新增系统（UI、音效、存档...）在这里挂载，系统之间用 bus 通信。
 */
import { Engine } from '@/core/Engine';
import { bus } from '@/core/events';
import { World } from '@/world/World';
import { Player } from '@/player/Player';
import { MAP_CARDS } from '@/world/registry';
import { mountDebugHud } from '@/ui/debugHud';
import { mountPassport } from '@/ui/passport';

const engine = new Engine(document.getElementById('app')!);
const world = new World(engine);
const player = new Player(engine, world);
mountDebugHud(document.getElementById('ui')!);
mountPassport(document.getElementById('ui')!);

// 开发调试用：在浏览器控制台里可以访问 __game
(window as any).__game = { engine, world, player, bus };

bus.emit('map:request', { id: MAP_CARDS[0].id });
engine.start();
