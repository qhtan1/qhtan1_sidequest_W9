// src/ui/MenuScreen.js
// Title / main menu screen (VIEW layer).

export class MenuScreen {
  constructor(pkg, assets) {
    this.pkg = pkg;
    this.assets = assets;

    // Font config — same as HUDRenderer / WinScreen
    this.FONT_COLS  = pkg.tuning?.hud?.font?.cols  ?? 19;
    this.CELL       = pkg.tuning?.hud?.font?.cell  ?? 30;
    this.FONT_SCALE = pkg.tuning?.hud?.font?.scale ?? 1 / 3;
    this.GLYPH_W    = this.CELL * this.FONT_SCALE; // ~10 px

    this.FONT_CHARS =
      pkg.tuning?.hud?.fontChars ??
      " !\"#$%&'()*+,-./0123456789:;<=>?@" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
        "abcdefghijklmnopqrstuvwxyz{|}~";

    this._blink = 0;
  }

  draw({ topScores = [], savedGame = null, showSettingsHint = false } = {}) {
    const viewW = this.pkg.view?.viewW ?? this.pkg.view?.w ?? 240;
    const viewH = this.pkg.view?.viewH ?? this.pkg.view?.h ?? 192;

    this._blink = (this._blink + 1) % 60;

    camera.off();
    drawingContext.imageSmoothingEnabled = false;
    push();
    imageMode(CORNER);

    // ---- Layer 1: forest background (furthest parallax layer) ----
    const bgImg = this.assets?.backgrounds?.bgFar;
    if (bgImg) {
      // stretch to fill canvas
      image(bgImg, 0, 0, viewW, viewH);
    } else {
      // fallback solid colour
      noStroke();
      fill(20, 16, 30);
      rect(0, 0, viewW, viewH);
    }

    // ---- Layer 2: soft semi-transparent panel ----
    // Panel sits in the centre, leaving a gap on each side
    const panelX = 16;
    const panelY = 20;
    const panelW = viewW - 32;
    const panelH = viewH - 36;

    // Outer glow: four progressively smaller, more opaque rects
    noStroke();
    for (let i = 4; i >= 0; i--) {
      fill(8, 5, 18, 30 + i * 20);
      rect(panelX - i * 3, panelY - i * 3, panelW + i * 6, panelH + i * 6, 6 + i * 2);
    }
    // Solid panel core
    fill(8, 5, 18, 195);
    rect(panelX, panelY, panelW, panelH, 6);

    // Thin border
    stroke(80, 140, 200, 120);
    strokeWeight(1);
    noFill();
    rect(panelX + 1, panelY + 1, panelW - 2, panelH - 2, 5);
    noStroke();

    pop();

    // ---- Layer 3: text ----

    // Title
    const title = "FOREST RESCUE";
    const txTitle = Math.round((viewW - title.length * this.GLYPH_W) / 2);
    this._drawOutlined(title, txTitle, 30, "#00e5ff");

    // Subtitle
    const sub = "A rescue adventure";
    const txSub = Math.round((viewW - sub.length * this.GLYPH_W) / 2);
    this._drawOutlined(sub, txSub, 48, "#aaaaaa");

    // Divider hint
    this._drawOutlined("- - - - - - - - - - -", Math.round((viewW - 21 * this.GLYPH_W) / 2), 62, "#334455");

    // Controls (keep each line ≤ 20 chars so it fits inside the panel)
    const ctrl1 = "Arrows:move  Z:atk";
    const ctrl2 = "Collect all leaves!";
    const txC1 = Math.round((viewW - ctrl1.length * this.GLYPH_W) / 2);
    const txC2 = Math.round((viewW - ctrl2.length * this.GLYPH_W) / 2);
    this._drawOutlined(ctrl1, txC1, 74, "#88aacc");
    this._drawOutlined(ctrl2, txC2, 86, "#88aacc");

    // Best times
    if (topScores.length > 0) {
      const hsLabel = "BEST TIMES";
      const txHs = Math.round((viewW - hsLabel.length * this.GLYPH_W) / 2);
      this._drawOutlined(hsLabel, txHs, 104, "#ffdc00");

      for (let i = 0; i < Math.min(3, topScores.length); i++) {
        const e = topScores[i];
        const row = `${i + 1}. ${(e.name ?? "---").padEnd(3)}  ${_formatMs(e.ms ?? 0)}`;
        const txRow = Math.round((viewW - row.length * this.GLYPH_W) / 2);
        this._drawOutlined(row, txRow, 116 + i * 14, i === 0 ? "#ffdc00" : "#ffffff");
      }
    }

    // ---- Last save slot ----
    if (savedGame) {
      const saveLabel = "LAST SAVE:";
      const txSave = Math.round((viewW - saveLabel.length * this.GLYPH_W) / 2);
      this._drawOutlined(saveLabel, txSave, viewH - 40, "#ff9900");

      const rescued = savedGame.leavesRescued ?? 0;
      const total   = savedGame.totalLeaves   ?? 0;
      const timeStr = _formatMs(savedGame.elapsedMs ?? 0);
      const saveInfo = `${rescued}/${total} leaves  ${timeStr}`;
      const txInfo = Math.round((viewW - saveInfo.length * this.GLYPH_W) / 2);
      this._drawOutlined(saveInfo, txInfo, viewH - 28, "#ffcc66");
    }

    // "Press ENTER" blink
    if (this._blink < 40) {
      const prompt = savedGame ? "ENTER: new game" : "Press ENTER to start";
      const txPrompt = Math.round((viewW - prompt.length * this.GLYPH_W) / 2);
      this._drawOutlined(prompt, txPrompt, viewH - 16, "#00ff7a");
    }

    // Settings hint (bottom-right area)
    if (showSettingsHint) {
      const hint = "O: settings";
      const txHint = Math.round((viewW - hint.length * this.GLYPH_W) / 2);
      this._drawOutlined(hint, txHint, viewH - 6, "#446655");
    }

    camera.on();
    noTint();
  }

  // ---- bitmap font helpers ----

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
