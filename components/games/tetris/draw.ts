import { ghostY, type Piece } from './board';
import { COLS, ROWS, BLOCK } from './constants';
import { SKINS, SKIN_IDS, type Skin, type SkinId } from './skins';
import { bakeSprite, getBaked, getLayer } from '../perf/spriteCache';

export function drawGrid(ctx: CanvasRenderingContext2D, skin: Skin) {
  ctx.strokeStyle = skin.gridLine;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

// ── Caché de dibujado (SPEC 12) ─────────────────────────────────────────────
// Fondo + rejilla y cada bloque (con su glow en neon o su trama en pixel) se
// pintan una vez en un canvas offscreen; cada frame hace `drawImage`.

const BOARD_W = COLS * BLOCK;
const BOARD_H = ROWS * BLOCK;
const BAKE_PAD = BLOCK; // margen para que el halo del glow (shadowBlur 15) no se recorte
const SPRITE_SIZE = BLOCK + BAKE_PAD * 2;
const GHOST_ALPHA = 0.2;

function background(skinId: SkinId): HTMLCanvasElement {
  return getBaked(`tetris:${skinId}:bg`, () =>
    bakeSprite(BOARD_W, BOARD_H, (b) => {
      const skin = SKINS[skinId];
      b.fillStyle = skin.boardBg;
      b.fillRect(0, 0, BOARD_W, BOARD_H);
      drawGrid(b, skin);
    }),
  );
}

// Acceso rápido sin crear strings por frame. Acotado: skins × 8 colores × 2 (sólido/fantasma)
const blockFast = new Map<number, HTMLCanvasElement>();

// El alfa del fantasma se hornea dentro del sprite (no con globalAlpha al
// pintarlo) para que la mezcla sea la misma que la del dibujado en vivo.
function blockSprite(
  skinIdx: number,
  colorIndex: number,
  ghost: boolean,
): HTMLCanvasElement {
  const code = (skinIdx * 8 + colorIndex) * 2 + (ghost ? 1 : 0);
  let sprite = blockFast.get(code);
  if (!sprite) {
    const skinId = SKIN_IDS[skinIdx];
    const skin = SKINS[skinId];
    const pad = BAKE_PAD / BLOCK;
    sprite = getBaked(
      `tetris:${skinId}:block:${colorIndex}:${ghost ? 'ghost' : 'solid'}`,
      () =>
        bakeSprite(SPRITE_SIZE, SPRITE_SIZE, (b) =>
          skin.drawBlock(
            b,
            pad,
            pad,
            colorIndex,
            BLOCK,
            ghost ? GHOST_ALPHA : undefined,
          ),
        ),
    );
    blockFast.set(code, sprite);
  }
  return sprite;
}

function paintBlock(
  ctx: CanvasRenderingContext2D,
  skinIdx: number,
  c: number,
  r: number,
  colorIndex: number,
  ghost: boolean,
) {
  if (!colorIndex) return;
  ctx.drawImage(
    blockSprite(skinIdx, colorIndex, ghost),
    c * BLOCK - BAKE_PAD,
    r * BLOCK - BAKE_PAD,
  );
}

// Capa con el fondo y las piezas ya fijadas. Solo cambia al fijar una pieza,
// al limpiar líneas, al empezar la partida o al cambiar de skin.
const BOARD_LAYER_KEY = 'tetris:board';

export function renderBoardLayer(board: number[][], skinId: SkinId) {
  const layer = getLayer(BOARD_LAYER_KEY, BOARD_W, BOARD_H);
  const lctx = layer.getContext('2d')!;
  const skinIdx = SKIN_IDS.indexOf(skinId);
  lctx.drawImage(background(skinId), 0, 0);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      paintBlock(lctx, skinIdx, c, r, board[r][c], false);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  board: number[][],
  current: Piece,
  skinId: SkinId,
) {
  const skinIdx = SKIN_IDS.indexOf(skinId);
  ctx.drawImage(getLayer(BOARD_LAYER_KEY, BOARD_W, BOARD_H), 0, 0);

  // ghost
  const shape = current.shape;
  const gy = ghostY(board, current);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      paintBlock(ctx, skinIdx, current.x + c, gy + r, shape[r][c], true);

  // current piece
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      paintBlock(
        ctx,
        skinIdx,
        current.x + c,
        current.y + r,
        shape[r][c],
        false,
      );
}

export function drawNext(
  nextCtx: CanvasRenderingContext2D,
  next: Piece,
  skin: Skin,
) {
  const NB = 30;
  nextCtx.fillStyle = skin.boardBg;
  nextCtx.fillRect(0, 0, nextCtx.canvas.width, nextCtx.canvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      skin.drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}
