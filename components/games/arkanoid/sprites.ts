export type BlockColor =
  | 'red'
  | 'yellow'
  | 'cyan'
  | 'magenta'
  | 'hotpink'
  | 'green'
  | 'gray';

export interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const SHEET_URL = '/games/arkanoid/spritesheet-breakout.png';

function explosionRow(sy: number): Frame[] {
  return [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));
}

// El bloque gray reutiliza los frames del rojo, como en el original.
export const EXPLOSION_FRAMES: Record<BlockColor, Frame[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

export const EXPLOSION_DURATION = 150; // ms

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BlockColor, Frame>,
};

let sheet: HTMLCanvasElement | null = null;
let pending: Promise<HTMLCanvasElement> | null = null;

export function loadSpritesheet(): Promise<HTMLCanvasElement> {
  if (sheet) return Promise.resolve(sheet);
  if (pending) return pending;

  pending = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const oc = document.createElement('canvas');
      oc.width = img.width;
      oc.height = img.height;
      oc.getContext('2d')?.drawImage(img, 0, 0);
      sheet = oc;
      resolve(oc);
    };
    img.onerror = () => {
      pending = null;
      reject(new Error('Failed to load spritesheet'));
    };
    img.src = SHEET_URL;
  });
  return pending;
}

export function isSpritesheetLoaded(): boolean {
  return sheet !== null;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!sheet) return;
  ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

export type SpriteName = 'paddle' | 'ball' | `block_${BlockColor}`;

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: SpriteName,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!sheet) return;
  const sp = name.startsWith('block_')
    ? SPRITES.blocks[name.slice(6) as BlockColor]
    : SPRITES[name as 'paddle' | 'ball'];
  if (!sp) return;
  ctx.drawImage(sheet, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}
