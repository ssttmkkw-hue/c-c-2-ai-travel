/**
 * 角色（Avatar）契约。玩家和 NPC 共用同一套角色系统。
 * 角色模型由 Cursor 在 src/avatar/ 下实现（任务卡 T03 / T04），这里只定义接口。
 */
import type * as THREE from 'three';

export interface AvatarRig {
  /** 角色根节点，原点在脚底中心，面朝 -Z */
  root: THREE.Group;
  /** 头部节点（第一人称相机挂点参考 & 帽子挂点） */
  head: THREE.Object3D;
  /**
   * 每帧调用。speed: 当前水平速度 (m/s)，0 = 站立；airborne: 是否在空中
   * 实现走路摆臂、跳跃姿势、待机呼吸等程序动画。
   */
  animate(dt: number, speed: number, airborne: boolean): void;
  /** 换装 */
  setOutfit(outfitId: string): void;
}

/** 服装定义（收集要素）。每张地图卡至少 1 套当地服装 */
export interface OutfitDef {
  id: string;
  name: string;
  /** 来自哪张地图卡（用于收集册分组），'default' 为初始服装 */
  origin: string;
  /** 颜色：上衣 / 下装 / 帽子或发饰（可选） */
  colors: { top: string; bottom: string; hat?: string };
  /** 可选的额外配件构建函数（斗笠、头巾、贝雷帽...），挂在 head 上 */
  buildAccessory?: () => THREE.Object3D;
}
