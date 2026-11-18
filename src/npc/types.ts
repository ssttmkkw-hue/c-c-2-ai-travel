/**
 * NPC 定义。NPC 写在地图卡的 npcs 字段里。
 * 对话系统 / AI 导游后续接入：现在 lines 是固定台词；将来 guide 字段会交给 AI 生成讲解。
 */
export interface NpcDef {
  id: string;
  name: string;
  /** 位置 [x, z]，朝向 yaw（弧度） */
  x: number;
  z: number;
  yaw?: number;
  /** 使用的服装 id（复用角色系统） */
  outfit?: string;
  /** 固定台词（按 E 交互时依次显示） */
  lines: string[];
  /** 预留：AI 导游的人设与知识范围（Claude 负责接入，Cursor 先不要实现） */
  guide?: { persona: string; topics: string[] };
}
