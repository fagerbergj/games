import { opLabel, WORLD, MAX_BREAD, type QuackstormState } from "@game-rules/quackstorm";

/** Screen-space helpers: the 100x100 world maps to the whole canvas. */
function makeCtx(W: number, H: number) {
  return {
    W,
    H,
    sx: (x: number) => (x / 100) * W,
    sy: (y: number) => (y / 100) * H,
    rx: (w: number) => (w / 100) * W,
    ry: (h: number) => (h / 100) * H,
  };
}

function ellipse(ctx: CanvasRenderingContext2D, c: ReturnType<typeof makeCtx>, x: number, y: number, rw: number, rh: number) {
  ctx.beginPath();
  ctx.ellipse(c.sx(x), c.sy(y), c.rx(rw), c.ry(rh), 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawKeep(ctx: CanvasRenderingContext2D, c: ReturnType<typeof makeCtx>, state: QuackstormState) {
  const barH = 7;
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, 0, c.W, c.sy(barH));
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(0, c.sy(barH) - 2, c.W, 2);
  // the Keep itself: a battlement strip
  ctx.fillStyle = "#374151";
  ctx.fillRect(0, c.sy(barH), c.W, c.sy(4));
  ctx.fillStyle = "#111827";
  const teeth = 12;
  for (let i = 0; i < teeth; i++) ctx.fillRect((i / teeth) * c.W, c.sy(barH), c.W / teeth - 4, c.sy(2));
  // hit points
  ctx.fillStyle = "#fde68a";
  ctx.font = `bold ${Math.round(c.H * 0.05)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`🏰 ${Math.max(0, state.keepHp)}`, c.W / 2, c.sy(barH + 9));
}

function drawGates(ctx: CanvasRenderingContext2D, c: ReturnType<typeof makeCtx>, state: QuackstormState) {
  for (const gate of state.gates) {
    const w = gate.span * 2;
    // lily pad
    ctx.fillStyle = gate.revealed ? "#15803d" : "#7c3aed";
    ellipse(ctx, c, gate.x, gate.y, w / 2, 5);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ellipse(ctx, c, gate.x, gate.y, w / 2 - 2, 4);
    // label
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(c.H * 0.032)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opLabel(gate.op), c.sx(gate.x), c.sy(gate.y));
  }
}

function drawDucklings(ctx: CanvasRenderingContext2D, c: ReturnType<typeof makeCtx>, state: QuackstormState) {
  for (const d of state.ducklings) {
    const r = d.big ? 6 : 2.2;
    ctx.fillStyle = d.big ? "#fbbf24" : "#fde047";
    ellipse(ctx, c, d.x, d.y, r, r);
    if (d.big) {
      ctx.fillStyle = "#b45309";
      ctx.font = `bold ${Math.round(c.H * 0.04)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("🦆", c.sx(d.x), c.sy(d.y - 8));
    }
  }
}

function drawGeese(ctx: CanvasRenderingContext2D, c: ReturnType<typeof makeCtx>, state: QuackstormState) {
  ctx.fillStyle = "#f8fafc";
  for (const g of state.geese) {
    const s = 3;
    const x = c.sx(g.x);
    const y = c.sy(g.y);
    ctx.beginPath();
    ctx.moveTo(x, y + c.ry(s));
    ctx.lineTo(x - c.rx(s), y - c.ry(s));
    ctx.lineTo(x + c.rx(s), y - c.ry(s));
    ctx.closePath();
    ctx.fill();
  }
}

function drawCannon(ctx: CanvasRenderingContext2D, c: ReturnType<typeof makeCtx>, state: QuackstormState) {
  const y = WORLD.cannonY;
  ctx.fillStyle = "#7c2d12";
  ctx.fillRect(0, c.sy(97), c.W, c.H - c.sy(97));
  ctx.font = `${Math.round(c.H * 0.045)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🥖", c.sx(state.cannonX), c.sy(y - 4));
  // aim line
  ctx.strokeStyle = "rgba(253,224,71,0.35)";
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(c.sx(state.cannonX), c.sy(y));
  ctx.lineTo(c.sx(state.cannonX), c.sy(WORLD.keepY));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBread(ctx: CanvasRenderingContext2D, c: ReturnType<typeof makeCtx>, state: QuackstormState) {
  const pad = c.W * 0.04;
  const w = c.W - pad * 2;
  const y = c.sy(92);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(pad, y, w, c.ry(2.4));
  const full = state.bread >= MAX_BREAD;
  ctx.fillStyle = full ? "#f97316" : "#fbbf24";
  ctx.fillRect(pad, y, w * (state.bread / MAX_BREAD), c.ry(2.4));
  ctx.fillStyle = "#fff7ed";
  ctx.font = `${Math.round(c.H * 0.022)}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(full ? "BIG MAMA READY 🦆" : "bread", pad + 4, y - c.ry(1.6));
}

/** Draw one engine state onto the canvas. */
export function drawGame(ctx: CanvasRenderingContext2D, W: number, H: number, state: QuackstormState) {
  const c = makeCtx(W, H);
  const water = ctx.createLinearGradient(0, 0, 0, H);
  water.addColorStop(0, "#0c4a6e");
  water.addColorStop(1, "#155e75");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, W, H);

  drawKeep(ctx, c, state);
  drawGates(ctx, c, state);
  drawDucklings(ctx, c, state);
  drawGeese(ctx, c, state);
  drawCannon(ctx, c, state);
  drawBread(ctx, c, state);
}
