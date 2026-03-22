// src/ui/MenuScreen.js
// Title / main menu screen (VIEW layer).
//
// Responsibilities:
// - Draw the game title and start prompt before gameplay begins
// - Show top high scores so returning players have context
// - Signal to main.js when the player wants to start (via .wantsStart flag)
//
// Non-goals:
// - Does NOT start the game itself (main.js state machine does)
// - Does NOT modify world state
// - Does NOT poll kb directly (main.js reads InputManager and sets wantsStart)

export class MenuScreen {
  constructor(pkg, assets) {
    this.pkg = pkg;
    this.assets = assets;

    // Font config — same setup as HUDRenderer / WinScreen
    this.FONT_COLS = pkg.tuning?.hud?.font?.cols ?? 19;
    this.CELL     = pkg.tuning?.hud?.font?.cell ?? 30;
    this.FONT_SCALE = pkg.tuning?.hud?.font?.scale ?? 1 / 3;
    this.GLYPH_W  = this.CELL * this.FONT_SCALE; // ~10 px

    this.FONT_CHARS =
      pkg.tuning?.hud?.fontChars ??
      " !\"#$%&'()*+,-./0123456789:;<=>?@" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
        "abcdefghijklmnopqrstuvwxyz{|}~";

    // Blink counter for the "Press ENTER" prompt
    this._blink = 0;
  }

  /**
   * Draw the menu screen. Call every frame while gameState === "menu".
   * @param {{ topScores: {name,ms}[] }} opts
   */
  draw({ topScores = [] } = {}) {
    const viewW = this.pkg.view?.viewW ?? this.pkg.view?.w ?? 240;
    const viewH = this.pkg.view?.viewH ?? this.pkg.view?.h ?? 192;

    this._blink = (this._blink + 1) % 60;

    camera.off();
    drawingContext.imageSmoothingEnabled = false;

    // Background
    push();
    noStroke();
    fill(20, 16, 30);
    rect(0, 0, viewW, viewH);
    pop();

    // Title
    const title = "FOX FOREST";
    const txTitle = Math.round((viewW - title.length * this.GLYPH_W) / 2);
    this._drawOutlined(title, txTitle, 30, "#00e5ff");

    // Subtitle
    const sub = "A rescue adventure";
    const txSub = Math.round((viewW - sub.length * this.GLYPH_W) / 2);
    this._drawOutlined(sub, txSub, 48, "#aaaaaa");

    // Controls hint
    const ctrl = "Arrow keys to move  Z to attack";
    const txCtrl = Math.round((viewW - ctrl.length * this.GLYPH_W) / 2);
    this._drawOutlined(ctrl, txCtrl, 74, "#888888");

    // High scores (top 3)
    if (topScores.length > 0) {
      const hsLabel = "BEST TIMES";
      const txHs = Math.round((viewW - hsLabel.length * this.GLYPH_W) / 2);
      this._drawOutlined(hsLabel, txHs, 100, "#ffdc00");

      for (let i = 0; i < Math.min(3, topScores.length); i++) {
        const e = topScores[i];
        const row = `${i + 1}. ${e.name ?? "---"}  ${_formatMs(e.ms ?? 0)}`;
        const txRow = Math.round((viewW - row.length * this.GLYPH_W) / 2);
        this._drawOutlined(row, txRow, 114 + i * 14, "#ffffff");
      }
    }

    // "Press ENTER" — blink every 30 frames
    if (this._blink < 40) {
      const prompt = "Press ENTER to start";
      const txPrompt = Math.round((viewW - prompt.length * this.GLYPH_W) / 2);
      this._drawOutlined(prompt, txPrompt, viewH - 24, "#00ff7a");
    }

    camera.on();
    noTint();
  }

  // ---------------------------------------------------------------------------
  // Internal bitmap font helpers (same pattern as WinScreen / LoseScreen)
  // ---------------------------------------------------------------------------

  _drawOutlined(str, x, y, fillHex) {
    tint("#000000");
    this._drawBitmap(str, x - 1, y);
    this._drawBitmap(str, x + 1, y);
    this._drawBitmap(str, x, y - 1);
    this._drawBitmap(str, x, y + 1);

    tint(fillHex);
    this._drawBitmap(str, x, y);

    noTint();
  }

  _drawBitmap(str, x, y) {
    const fontImg = this.assets?.fontImg;
    if (!fontImg) return;

    str = String(str);
    const dw = this.GLYPH_W;

    for (let i = 0; i < str.length; i++) {
      const idx = this.FONT_CHARS.indexOf(str[i]);
      if (idx < 0) continue;
      const sx = (idx % this.FONT_COLS) * this.CELL;
      const sy = Math.floor(idx / this.FONT_COLS) * this.CELL;
      image(
        fontImg,
        Math.round(x + i * dw), Math.round(y),
        this.GLYPH_W, this.GLYPH_W,
        sx, sy, this.CELL, this.CELL,
      );
    }
  }
}

function _formatMs(ms) {
  ms = Number(ms) || 0;
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  const hs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(hs).padStart(2,"0")}`;
}
