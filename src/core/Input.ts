/**
 * 键盘 + 鼠标输入，以及给触屏层用的虚拟输入。
 * 点击画布进入 pointer lock（鼠标转视角），Esc 退出。触屏（pointer: coarse）不锁鼠标。
 * 其他模块只读取状态：input.isDown('KeyW') / input.consumeMouseDelta() / input.wasPressed('KeyV')
 * 触屏层只写：setVirtualMove / setVirtualRun / addLook / pressVirtual。
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  /** 摇杆 / 虚拟按键，和真实键盘分开，避免互相清掉 */
  private virtualDown = new Set<string>();
  private virtualPressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;
  private moveX = 0;
  private moveY = 0;
  private virtualRun = false;
  locked = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());
    target.addEventListener('click', () => {
      if (isCoarsePointer()) return;
      if (!this.locked) target.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === target;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    target.addEventListener('wheel', (e) => (this.wheel += Math.sign(e.deltaY)), { passive: true });
  }

  /** 主指针是触屏时为 true。这类设备上 pointer lock 没有意义。 */
  static isCoarsePointer(): boolean {
    return isCoarsePointer();
  }

  isDown(code: string): boolean {
    return this.down.has(code) || this.virtualDown.has(code);
  }

  /** 本帧是否刚按下（每帧末尾由 Engine 调用 endFrame 清空） */
  wasPressed(code: string): boolean {
    return this.pressed.has(code) || this.virtualPressed.has(code);
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = this.mouseDY = 0;
    return d;
  }

  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /**
   * 虚拟摇杆。x 右正左负，y 前正后负，各自约 -1..1。
   * 过了死区就当成按住 WASD，玩家移动逻辑不用改。
   */
  setVirtualMove(x: number, y: number): void {
    this.moveX = clamp(x, -1, 1);
    this.moveY = clamp(y, -1, 1);
    this.syncVirtualKeys();
  }

  /** 按住跑（相当于 Shift）。松手后下一帧不再跑。 */
  setVirtualRun(on: boolean): void {
    this.virtualRun = on;
    this.syncVirtualKeys();
  }

  /** 视角增量，单位和鼠标 movementX/Y 一样（像素） */
  addLook(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    this.mouseDX += dx;
    this.mouseDY += dy;
  }

  /** 点按一次，本帧 wasPressed 为 true。跳跃传 'Space'。 */
  pressVirtual(code: string): void {
    this.virtualPressed.add(code);
  }

  /** 清掉键盘和虚拟输入。切后台时用，避免摇杆卡在按下。 */
  releaseAll(): void {
    this.down.clear();
    this.pressed.clear();
    this.virtualDown.clear();
    this.virtualPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.moveX = 0;
    this.moveY = 0;
    this.virtualRun = false;
  }

  endFrame(): void {
    this.pressed.clear();
    this.virtualPressed.clear();
  }

  private syncVirtualKeys(): void {
    const dead = 0.18;
    this.setVirt('KeyW', this.moveY > dead);
    this.setVirt('KeyS', this.moveY < -dead);
    this.setVirt('KeyA', this.moveX < -dead);
    this.setVirt('KeyD', this.moveX > dead);
    const moving = Math.abs(this.moveX) > dead || Math.abs(this.moveY) > dead;
    this.setVirt('ShiftLeft', this.virtualRun && moving);
  }

  private setVirt(code: string, on: boolean): void {
    if (on) this.virtualDown.add(code);
    else this.virtualDown.delete(code);
  }
}

function isCoarsePointer(): boolean {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    return false;
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}
