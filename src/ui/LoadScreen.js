// src/ui/LoadScreen.js
// Load-save overlay screen (VIEW layer).
//
// Drawn on top of the game world when the player presses L.
// Shows the single save slot's data (leaves + time) and offers
//   ENTER → confirm load (restarts level with saved timer)
//   ESC   → cancel, return to game
//
// Does NOT modify world state — loading is controlled by main.js.

export class LoadScreen {
  constructor(pkg, assets) {
    this.pkg = pkg;
    this.assets = assets;

    // Font config — same as HUDRenderer / WinScreen / MenuScreen / PauseScreen
    this.FONT_COLS  = pkg.tuning?.hud?.font?.cols  ?? 19;
    this.CELL       = pkg.tuning?.hud?.font?.cell  ?? 30;
    this.FONT_SCALE = pkg.tuning?.hud?.font?.scale ?? 1 / 3;
    this.GLYPH_W    = this.CELL * this.FONT_SCALE; // ~10 px

    this.FONT_CHARS =
      pkg.tuning?.hud?.fontChars ??
      " !\"#$%&'()*+,-./0123456789:;<=>?@" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
        "abcdefghijklmnopqrstuvwxyz{|}~";
  }

  // savedGame: { leavesRescued, totalLeaves, elapsedMs } or null
  draw(savedGame) {
    const viewW = this.pkg.view?.viewW ?? this.pkg.view?.w ?? 240;
    const viewH = this.pkg.view?.viewH ?? this.pkg.view?.h ?? 192;

    camera.off();
    drawingContext.imageSmoothingEnabled = false;

    // Semi-transparent dark overlay
    push();
    noStroke();
    fill(0, 0, 0, 160);
    rect(0, 0, viewW, viewH);
    pop();

    // Panel size depends on whether we have save data
    const panelW = 222;
    const panelH = savedGame ? 76 : 56;
    const panelX = Math.round((viewW - panelW) / 2);
    const panelY = Math.round((viewH - panelH) / 2);

    push();
    noStroke();
    fill(8, 5, 18, 220);
    rect(panelX, panelY, panelW, panelH, 5);
    stroke(80, 140, 200, 140);
    strokeWeight(1);
    noFill();
    rect(panelX + 1, panelY + 1, panelW - 2, panelH - 2, 4);
    noStroke();
    pop();

    // Title
    const title = "LOAD SAVE";
    const txTitle = Math.round((viewW - title.length * this.GLYPH_W) / 2);
    this._drawOutlined(title, txTitle, panelY + 10, "#ffdc00");

    if (savedGame) {
      // Save slot data
      const rescued = savedGame.leavesRescued ?? 0;
      const total   = savedGame.totalLeaves   ?? 0;
      const timeStr = _formatMs(savedGame.elapsedMs ?? 0);
      const info = `${rescued}/${total} leaves  ${timeStr}`;
      const txInfo = Math.round((viewW - info.length * this.GLYPH_W) / 2);
      this._drawOutlined(info, txInfo, panelY + 28, "#ffffff");

      // Divider
      this._drawOutlined("- - - - - - - - - -", Math.round((viewW - 19 * this.GLYPH_W) / 2), panelY + 42, "#334455");

      // Prompt
      const conf = "ENTER:load  ESC:cancel";
      const txConf = Math.round((viewW - conf.length * this.GLYPH_W) / 2);
      this._drawOutlined(conf, txConf, panelY + 56, "#88aacc");
    } else {
      // No save found
      const noSave = "No save data found";
      const txNoSave = Math.round((viewW - noSave.length * this.GLYPH_W) / 2);
      this._drawOutlined(noSave, txNoSave, panelY + 24, "#aaaaaa");

      const cancel = "Press ESC to close";
      const txCancel = Math.round((viewW - cancel.length * this.GLYPH_W) / 2);
      this._drawOutlined(cancel, txCancel, panelY + 38, "#888888");
    }

    camera.on();
    noTint();
  }

  // ---- bitmap font helpers (same pattern as PauseScreen) ----

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
    for (let i = 0; i < str.length; i++) {
      const idx = this.FONT_CHARS.indexOf(str[i]);
      if (idx < 0) continue;
      const sx = (idx % this.FONT_COLS) * this.CELL;
      const sy = Math.floor(idx / this.FONT_COLS) * this.CELL;
      image(fontImg,
        Math.round(x + i * this.GLYPH_W), Math.round(y),
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
