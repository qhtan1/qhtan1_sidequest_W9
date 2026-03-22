// src/WinScreen.js
// Win overlay screen (VIEW layer).
//
// Responsibilities:
// - Render win-state overlay in screen-space (camera.off())
// - Display completion message + relevant stats (time, score, leaderboard)
// - Provide prompts for restart / submission actions (UI only)
//
// Non-goals:
// - Does NOT modify world state directly (Game/Level do)
// - Does NOT compute high scores (HighScoreManager does)
// - Does NOT poll kb directly (InputManager -> Game)
//
// Architectural notes:
// - Game decides when to show WinScreen (based on Level.won).
// - Keeps UI rendering separate from gameplay simulation.

export class WinScreen {
  constructor(pkg, assets) {
    this.pkg = pkg;
    this.assets = assets;

    // Bitmap font config (same charmap used in Level HUD)
    this.FONT_COLS = pkg.tuning?.hud?.fontCols ?? 19;
    this.CELL = pkg.tuning?.hud?.cell ?? 30;

    this.GLYPH_DRAW = 10; // draw size: 30/3 = crisp integer scale
    this.GLYPH_W = 8; // spacing between characters (tighter than draw size)

    this.FONT_CHARS =
      pkg.tuning?.hud?.fontChars ??
      " !\"#$%&'()*+,-./0123456789:;<=>?@" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
        "abcdefghijklmnopqrstuvwxyz{|}~";
  }

  draw({
    elapsedMs,
    topScores = [],
  } = {}) {
    const viewW = this.pkg.view?.viewW ?? this.pkg.view?.w ?? 240;
    const viewH = this.pkg.view?.viewH ?? this.pkg.view?.h ?? 192;

    camera.off();
    drawingContext.imageSmoothingEnabled = false;
    push();
    noStroke();
    fill(0, 120);
    rect(0, 0, viewW, viewH);
    pop();

    // ---- YOU WIN heading ----
    const msg1 = "YOU WIN!";
    const msg2 = `TIME: ${formatTimeMs(elapsedMs ?? 0)}`;
    const x1 = Math.round((viewW - msg1.length * this.GLYPH_W) / 2);
    const x2 = Math.round((viewW - msg2.length * this.GLYPH_W) / 2);
    let y = Math.round(viewH / 2 - 60);
    this._drawOutlined(window, msg1, x1, y, "#00e5ff");
    y += 24;
    this._drawOutlined(window, msg2, x2, y, "#ffdc00");
    y += 22;

    // ---- Best times ----
    if (topScores.length > 0) {
      const header = "BEST TIMES";
      const xH = Math.round((viewW - header.length * this.GLYPH_W) / 2);
      this._drawOutlined(window, header, xH, y, "#ffffff");
      y += 18;
      for (let i = 0; i < Math.min(3, topScores.length); i++) {
        const entry = topScores[i] || { name: "---", ms: 0 };
        const timeStr = entry.ms ? formatTimeMs(entry.ms) : "--:--.--";
        const row = `${i + 1}. ${timeStr}`;
        const xRow = Math.round((viewW - row.length * this.GLYPH_W) / 2);
        this._drawOutlined(window, row, xRow, y, i === 0 ? "#ffdc00" : "#cccccc");
        y += 16;
      }
      y += 8;
    }

    // ---- Restart prompt ----
    const prompt = "Press R to restart";
    const xP = Math.round((viewW - prompt.length * this.GLYPH_W) / 2);
    this._drawOutlined(window, prompt, xP, y, "#aaaaaa");

    camera.on();
    noTint();
  }

  _drawOutlined(g, str, x, y, fillHex) {
    g.tint("#000000");
    this._drawBitmap(g, str, x - 1, y);
    this._drawBitmap(g, str, x + 1, y);
    this._drawBitmap(g, str, x, y - 1);
    this._drawBitmap(g, str, x, y + 1);

    g.tint(fillHex);
    this._drawBitmap(g, str, x, y);

    g.noTint();
  }

  _drawBitmap(g, str, x, y) {
    const fontImg = this.assets.fontImg;
    if (!fontImg) return;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const idx = this.FONT_CHARS.indexOf(ch);
      if (idx === -1) continue;
      const sx = (idx % this.FONT_COLS) * this.CELL;
      const sy = Math.floor(idx / this.FONT_COLS) * this.CELL;
      g.image(
        fontImg,
        Math.round(x + i * this.GLYPH_W),
        Math.round(y),
        this.GLYPH_DRAW,
        this.GLYPH_DRAW,
        sx,
        sy,
        this.CELL,
        this.CELL,
      );
    }
  }
}

function formatTimeMs(ms) {
  ms = Number(ms) || 0;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const hh = Math.floor((ms % 1000) / 10);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  const hs = String(hh).padStart(2, "0");
  return `${mm}:${ss}.${hs}`;
}
