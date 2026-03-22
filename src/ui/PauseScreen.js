// src/ui/PauseScreen.js
// Pause overlay screen (VIEW layer).
//
// Drawn on top of the game world when the player presses P.
// Does NOT modify world state — pausing is controlled by main.js.

export class PauseScreen {
  constructor(pkg, assets) {
    this.pkg = pkg;
    this.assets = assets;

    // Font config — same as HUDRenderer / WinScreen / MenuScreen
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

  draw() {
    const viewW = this.pkg.view?.viewW ?? this.pkg.view?.w ?? 240;
    const viewH = this.pkg.view?.viewH ?? this.pkg.view?.h ?? 192;

    camera.off();
    drawingContext.imageSmoothingEnabled = false;

    // Semi-transparent dark overlay
    push();
    noStroke();
    fill(0, 0, 0, 150);
    rect(0, 0, viewW, viewH);
    pop();

    // Panel
    const panelW = 200;
    const panelH = 50;
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

    // "PAUSED"
    const title = "PAUSED";
    const tx = Math.round((viewW - title.length * this.GLYPH_W) / 2);
    this._drawOutlined(title, tx, panelY + 12, "#ffdc00");

    // "Press P to resume"
    const sub = "Press P to resume";
    const sx = Math.round((viewW - sub.length * this.GLYPH_W) / 2);
    this._drawOutlined(sub, sx, panelY + 30, "#aaaaaa");

    camera.on();
    noTint();
  }

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
