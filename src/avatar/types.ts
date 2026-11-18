/**
 * 角色（Avatar）契约。玩家和 NPC 共用同一套角色系统。
 * 角色模型由 Cursor 在 src/avatar/ 下实现（任务卡 T03 / T04），这里只定义接口。
 */
import type * as THREE from 'three';

export interface AvatarRig {
  /** 角色根节点，原点在脚底中心，面朝 -Z */
  root: THREE.Group;
  /** 头部节点（第一人称相机挂点参考 & 帽子挂点）。原点在脖子，+Y 朝上 */
  head: THREE.Object3D;
  /**
   * 躯干节点（腰带、领子、围巾、背包等身上配件的挂点）。原点在腰部（躯干底部中心），+Y 朝上。
   * 头部以后可能单独转动（看向玩家），所以身上的配件不要挂在 head 上。
   */
  torso: THREE.Object3D;
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
  /**
   * 颜色：上衣 / 下装 / 角色自带扁帽的颜色。
   * hat 不填 = 不戴自带扁帽（有造型头饰的套装就不填，避免两顶帽子叠在一起）
   */
  colors: { top: string; bottom: string; hat?: string };
  /** 头上配件（斗笠、头巾、贝雷帽...），挂在 head 上 */
  buildAccessory?: () => THREE.Object3D;
  /** 身上配件（腰带、水手领、条纹、围巾...），挂在 torso 上 */
  buildBodyAccessory?: () => THREE.Object3D;
}
