/**
 * CodePen 원본과 동일한 Pixi 군집 (Victor·루프·팔다리 height).
 * 스프라이트: https://s3-us-west-2.amazonaws.com/s.cdpn.io/49240/sprites.json
 * (시트에 foot.png 없음 → shoe.png)
 */
import { Application, Assets, Container, Sprite, type Spritesheet, type Texture } from "pixi.js";

const SPRITES_JSON = "https://s3-us-west-2.amazonaws.com/s.cdpn.io/49240/sprites.json";

const shirtColors = [
  "43875e", "03aa96", "e85140", "cbaa74", "f78b1f", "d5d4d2", "01a451", "da2c47", "615ea3", "5f5ea0", "e77e9c",
  "14afcd", "dfb217", "444547", "8e60a8", "8b8d8a", "0093d2", "f39079",
];
const skinColors = ["755d5b", "ca6c62", "ed917c", "dab5af", "c66c63"];
const pantsColors = ["0293d2", "444547", "8b60a7", "74a1b4", "6f6f6f", "00a996", "d1aa73", "416c51"];
const hairColors = ["804c3e", "a16938", "454648", "ceab75", "333736"];
const shoeColors = ["bebab9", "414745", "006ead", "a37953", "dadbdd", "646569", "8c8c8a", "e54e5f"];
const backpackColors = ["63bf8c", "e74f5c", "454648"];

function getRandomArrayValue<T>(array: readonly T[]): T {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex]!;
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

class Victor {
  constructor(public x: number, public y: number) {}

  add(v: Victor): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  subtract(v: Victor): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  multiply(o: { x: number; y: number }): this {
    this.x *= o.x;
    this.y *= o.y;
    return this;
  }

  normalize(): this {
    const m = Math.hypot(this.x, this.y);
    if (m > 1e-12) {
      this.x /= m;
      this.y /= m;
    }
    return this;
  }

  limit(maxVal: number, maxValY?: number): this {
    if (maxValY !== undefined) {
      this.x = Math.min(Math.max(this.x, -maxVal), maxVal);
      this.y = Math.min(Math.max(this.y, -maxValY), maxValY);
      return this;
    }
    const len = Math.hypot(this.x, this.y);
    if (len > maxVal && len > 0) {
      const f = maxVal / len;
      this.x *= f;
      this.y *= f;
    }
    return this;
  }

  rotate(angle: number): this {
    const nx = this.x * Math.cos(angle) - this.y * Math.sin(angle);
    const ny = this.x * Math.sin(angle) + this.y * Math.cos(angle);
    this.x = nx;
    this.y = ny;
    return this;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }
}

type TextureMap = Record<string, Texture>;

type PersonBody = {
  container: Container;
  torso: Sprite;
  head: Sprite;
  backpack?: Sprite;
  armLeft: { container: Container; arm: Sprite; hand: Sprite };
  armRight: { container: Container; arm: Sprite; hand: Sprite };
  legLeft: { container: Container; leg: Sprite; foot: Sprite };
  legRight: { container: Container; leg: Sprite; foot: Sprite };
};

let siteWidth = 0;
let siteHeight = 0;
const spriteHeight = 50;

class Person {
  position: Victor;
  velocity: Victor;
  acceleration: Victor;
  maxSpeed = 10;
  maxForce = 0.01;
  scale = spriteHeight;
  scalingUp = false;
  shirtColor: number;
  skinColor: number;
  pantsColor: number;
  hairColor: number;
  shoeColor: number;
  backpackColor: number;
  x = 0;
  y = 0;
  body!: PersonBody;

  constructor() {
    this.position = new Victor(Math.random() * siteWidth, Math.random() * siteHeight);
    this.velocity = new Victor(Math.random() * (1 - 0.7) + 0.7, Math.random() * (1 - 0.7) + 0.7);
    this.acceleration = new Victor(0, 0);
    this.shirtColor = parseInt(getRandomArrayValue(shirtColors), 16);
    this.skinColor = parseInt(getRandomArrayValue(skinColors), 16);
    this.pantsColor = parseInt(getRandomArrayValue(pantsColors), 16);
    this.hairColor = parseInt(getRandomArrayValue(hairColors), 16);
    this.shoeColor = parseInt(getRandomArrayValue(shoeColors), 16);
    this.backpackColor = parseInt(getRandomArrayValue(backpackColors), 16);
    this.velocity.rotate(Math.random() * 4);
  }

  generateSprite(textures: TextureMap) {
    const id = (key: string) => {
      const t = textures[key];
      if (!t) throw new Error(`guestbookFlock: missing texture "${key}"`);
      return t;
    };
    const footKey = textures["foot.png"] ? "foot.png" : "shoe.png";
    const backpack = getRandomNumber(0, 1);

    const c = new Container();
    const armL = new Container();
    const armR = new Container();
    const legL = new Container();
    const legR = new Container();

    const torso = new Sprite(id("torso.png"));
    torso.anchor.set(0.5, 0.5);
    torso.tint = this.shirtColor;

    const head = new Sprite(id(`head-${getRandomNumber(1, 5)}.png`));
    head.anchor.set(0.5, 0.5);
    head.tint = this.hairColor;

    let backpackSprite: Sprite | undefined;
    if (backpack) {
      backpackSprite = new Sprite(id("backpack.png"));
      backpackSprite.anchor.set(0.5, 0.5);
      backpackSprite.position.set(0, 18);
      backpackSprite.tint = this.backpackColor;
    }

    const armLa = new Sprite(id("arm.png"));
    armLa.anchor.set(0.5, 1);
    armLa.tint = this.shirtColor;
    const armLh = new Sprite(id("hand.png"));
    armLh.position.set(0, -68);
    armLh.anchor.set(0.5, 1);
    armLh.tint = this.skinColor;

    const armRa = new Sprite(id("arm.png"));
    armRa.anchor.set(0.5, 1);
    armRa.tint = this.shirtColor;
    const armRh = new Sprite(id("hand.png"));
    armRh.scale.x = -1;
    armRh.position.set(0, -68);
    armRh.anchor.set(0.5, 1);
    armRh.tint = this.skinColor;

    const legLl = new Sprite(id("leg.png"));
    legLl.anchor.set(0.5, 1);
    legLl.tint = this.pantsColor;
    const footL = new Sprite(id(footKey));
    footL.position.set(0, -60);
    footL.anchor.set(0.5, 0.5);
    footL.tint = this.shoeColor;

    const legRl = new Sprite(id("leg.png"));
    legRl.scale.x = -1;
    legRl.anchor.set(0.5, 1);
    legRl.tint = this.pantsColor;
    const footR = new Sprite(id(footKey));
    footR.scale.x = -1;
    footR.position.set(0, -60);
    footR.anchor.set(0.5, 0.5);
    footR.tint = this.shoeColor;

    armL.addChild(armLh, armLa);
    armL.position.set(-48, 0);
    armR.addChild(armRh, armRa);
    armR.position.set(48, 0);
    legL.addChild(footL, legLl);
    legL.position.set(-30, 0);
    legR.addChild(footR, legRl);
    legR.position.set(30, 0);

    c.addChild(legL, legR, armL, armR, torso);
    if (backpackSprite) c.addChild(backpackSprite);
    c.addChild(head);
    c.position.set(100, 100);
    c.scale.set(0.2, 0.2);

    this.body = {
      container: c,
      torso,
      head,
      backpack: backpackSprite,
      armLeft: { container: armL, arm: armLa, hand: armLh },
      armRight: { container: armR, arm: armRa, hand: armRh },
      legLeft: { container: legL, leg: legLl, foot: footL },
      legRight: { container: legR, leg: legRl, foot: footR },
    };
  }

  boundaries() {
    const sw = Math.max(1, siteWidth);
    const sh = Math.max(1, siteHeight);
    const d = Math.min(60, Math.max(18, Math.min(sw, sh) * 0.1));
    if (sw < d * 2 || sh < d * 2) {
      return;
    }
    let desired: Victor | null = null;

    if (this.position.x < d) {
      desired = new Victor(this.maxSpeed, this.velocity.y);
    } else if (this.position.x > sw - d) {
      desired = new Victor(-this.maxSpeed, this.velocity.y);
    }

    if (this.position.y < d) {
      desired = new Victor(this.velocity.x, this.maxSpeed);
    } else if (this.position.y > sh - d) {
      desired = new Victor(this.velocity.x, -this.maxSpeed);
    }

    if (desired !== null) {
      desired.normalize();
      desired.multiply({ x: this.maxSpeed, y: this.maxSpeed });
      const steer = desired.subtract(this.velocity);
      steer.limit(this.maxForce, this.maxForce);
      this.applyForce(steer);
    }
  }

  applyForce(force: Victor) {
    this.acceleration.add(force);
  }

  animateScale() {
    const scaleSpeed = this.velocity.length() * 3;
    const minSize = -70;
    const maxSize = 70;

    if (this.scalingUp === true) {
      if (this.scale <= maxSize) {
        this.scale += scaleSpeed;
      } else {
        this.scalingUp = false;
        this.scale = maxSize;
      }
    } else {
      if (this.scale >= minSize) {
        this.scale -= scaleSpeed;
      } else {
        this.scalingUp = true;
        this.scale = minSize;
      }
    }
  }
}

let people: Person[] = [];

async function ensureSpritesheetTextures(sheet: Spritesheet): Promise<TextureMap> {
  if (Object.keys(sheet.textures).length === 0 && typeof sheet.parse === "function") {
    await sheet.parse();
  }
  return sheet.textures as TextureMap;
}

function waitForHostSize(host: HTMLElement): Promise<void> {
  const ok = () => host.clientWidth >= 32 && host.clientHeight >= 32;
  if (ok()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      ro.disconnect();
      clearTimeout(timeoutId);
      resolve();
    };
    const ro = new ResizeObserver(() => {
      if (ok()) finish();
    });
    ro.observe(host);
    const tick = () => {
      if (ok()) {
        finish();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const timeoutId = window.setTimeout(finish, 4000);
  });
}

export function initGuestbookFlock(host: HTMLElement): () => void {
  let destroyed = false;
  let app: Application | null = null;
  let simulationLoop: (() => void) | null = null;
  let onWinResize: (() => void) | null = null;
  let ro: ResizeObserver | null = null;

  const resize = () => {
    if (!app || destroyed) return;
    siteWidth = host.clientWidth;
    siteHeight = host.clientHeight;
    app.resize();
  };

  const run = async () => {
    await waitForHostSize(host);
    if (destroyed) return;

    siteWidth = host.clientWidth;
    siteHeight = host.clientHeight;

    const appInst = new Application();
    await appInst.init({
      resizeTo: host,
      resolution: window.devicePixelRatio ?? 1,
      autoDensity: true,
      backgroundColor: 0xf0e7da,
    });

    if (destroyed) {
      appInst.destroy(true);
      return;
    }

    app = appInst;
    host.appendChild(app.canvas as HTMLCanvasElement);

    let textures: TextureMap;
    try {
      const loaded = await Assets.load<Spritesheet>(SPRITES_JSON);
      textures = await ensureSpritesheetTextures(loaded);
    } catch {
      host.removeChild(app.canvas as HTMLCanvasElement);
      app.destroy(true);
      app = null;
      const p = document.createElement("p");
      p.className = "guestbook__flock-fallback";
      p.textContent = "애니메이션을 불러오지 못했습니다. 네트워크를 확인해 주세요.";
      host.appendChild(p);
      return;
    }

    if (destroyed) {
      app.destroy(true);
      app = null;
      return;
    }

    const groupSize = 30;
    people = [];
    siteWidth = app.screen.width;
    siteHeight = app.screen.height;

    for (let i = 0; i < groupSize; i++) {
      const person = new Person();
      people.push(person);
      person.generateSprite(textures);
      const sprite = person.body.container;
      sprite.x = Math.random() * siteWidth;
      sprite.y = Math.random() * siteHeight;
      app.stage.addChild(sprite);
    }

    simulationLoop = () => {
      if (!app || destroyed) return;
      siteWidth = app.screen.width;
      siteHeight = app.screen.height;

      for (let i = 0; i < people.length; i++) {
        const person = people[i]!;
        const sprite = person.body.container;

        person.velocity.add(person.acceleration);
        person.velocity.limit(person.maxSpeed);
        person.position.add(person.velocity);
        person.x = person.position.x;
        person.y = person.position.y;
        person.acceleration.multiply({ x: 0, y: 0 });
        person.boundaries();
        person.animateScale();

        sprite.x = person.position.x;
        sprite.y = person.position.y;
        sprite.rotation = person.velocity.angle() + 1.5708;
        person.body.armLeft.container.height = person.scale;
        person.body.armRight.container.height = person.scale * -1;
        person.body.legLeft.container.height = person.scale * -1;
        person.body.legRight.container.height = person.scale;
      }
    };

    app.ticker.add(simulationLoop);

    onWinResize = () => resize();
    window.addEventListener("resize", onWinResize);
    ro = new ResizeObserver(() => resize());
    ro.observe(host);
  };

  void run();

  return () => {
    destroyed = true;
    if (app && simulationLoop) {
      app.ticker.remove(simulationLoop);
      simulationLoop = null;
    }
    if (onWinResize) window.removeEventListener("resize", onWinResize);
    if (ro) ro.disconnect();
    people = [];
    if (app) {
      app.destroy(true, { children: true, texture: false });
      app = null;
    }
    while (host.firstChild) host.removeChild(host.firstChild);
  };
}
