import { ghostY, type Piece } from './board';
import { COLS, ROWS, BLOCK } from './constants';
import type { Skin } from './skins';

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

export function draw(
  ctx: CanvasRenderingContext2D,
  board: number[][],
  current: Piece,
  skin: Skin,
) {
  ctx.fillStyle = skin.boardBg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawGrid(ctx, skin);

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      skin.drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY(board, current);
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        skin.drawBlock(
          ctx,
          current.x + c,
          gy + r,
          current.shape[r][c],
          BLOCK,
          0.2,
        );

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      skin.drawBlock(
        ctx,
        current.x + c,
        current.y + r,
        current.shape[r][c],
        BLOCK,
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
