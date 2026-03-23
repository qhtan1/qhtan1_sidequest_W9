// src/ui/SettingsScreen.js
// Settings / Accessibility overlay (VIEW layer).
//
// Drawn on top of the menu when the player presses O.
// Manages a small set of accessibility toggles and persists them
// to localStorage so they survive page reloads.
//
// Current settings:
//   reducedMotion  – suppresses tint-blink effects (boar flash, player hurt blink)
//
// How settings are consumed by gameplay:
//   window.settings.reducedMotion is read by PlayerEntity and BoarSystem each frame.

const STORAGE_KEY = "gbda302_settings_v1";

// ---------------------------------------------------------------------------
// Module-level settings object (shared with rest of game via window.settings)
// ---------------------------------------------------------------------------

function _loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

function _saveToStorage(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (_) {}
}

// Initialise window.settings once (safe to call multiple times).
export function initSettings() {
  const saved = _loadFromStorage();
  window.settings = {
    reducedMotion: saved.reducedMotion === true,
  };
}

export function saveSettings() {
  _saveToStorage(window.settings ?? {});
}

// ---------------------------------------------------------------------------
// SettingsScreen class
// ---------------------------------------------------------------------------

export class SettingsScreen {
  constructor(pkg, assets) {
    this.pkg    = pkg;
    this.assets = assets;

    // Font config — same as all other UI screens
    this.FONT_COLS  = pkg.tuning?.hud?.font?.cols  ?? 19;
    this.CELL       = pkg.tuning?.hud?.font?.cell  ?? 30;
    this.FONT_SCALE = pkg.tuning?.hud?.font?.scale ?? 1 / 3;
    this.GLYPH_W    = this.CELL * this.FONT_SCALE; // ~10 px

    this.FONT_CHARS =
      pkg.tuning?.hud?.fontChars ??
      " !\"#$%&'()*+,-./0123456789:;<=>?@" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
        "abcdefghijklmnopqrstuvwxyz{|}~";

    // Menu cursor (0-indexed over OPTIONS array)
    this._cursor = 0;
  }

  // ---- public draw --------------------------------------------------------

  draw() {
    const viewW = this.pkg.view?.viewW ?? this.pkg.view?.w ?? 240;
    const viewH = this.pkg.view?.viewH ?? this.pkg.view?.h ?? 192;

    camera.off();
    drawingContext.imageSmoothingEnabled = false;

    // Dim overlay
    push();
    noStroke();
    fill(0, 0, 0, 170);
    rect(0, 0, viewW, viewH);
    pop();

    // Panel — wide enough to hold the longest option line (21 chars × 10px = 210px)
    // with comfortable left/right margin inside a 240px viewport.
    const panelW = 224;
    const panelH = 90;
    const panelX = Math.round((viewW - panelW) / 2);
    const panelY = Math.round((viewH - panelH) / 2);

    push();
    noStroke();
    // Outer glow
    for (let i = 3; i >= 0; i--) {
      fill(8, 5, 18, 30 + i * 25);
      rect(panelX - i * 2, panelY - i * 2, panelW + i * 4, panelH + i * 4, 5 + i);
    }
    fill(8, 5, 18, 230);
    rect(panelX, panelY, panelW, panelH, 5);
    stroke(80, 140, 200, 140);
    strokeWeight(1);
    noFill();
    rect(panelX + 1, panelY + 1, panelW - 2, panelH - 2, 4);
    noStroke();
    pop();

    // Title
    const title = "SETTINGS";
    const txTitle = Math.round((viewW - title.length * this.GLYPH_W) / 2);
    this._drawOutlined(title, txTitle, panelY + 10, "#ffdc00");

    // Divider
    this._drawOutlined("- - - - - - - - - - -",
      Math.round((viewW - 21 * this.GLYPH_W) / 2), panelY + 24, "#334455");

    // Options
    const s = window.settings ?? {};
    const options = [
      {
        label: "Reduced Motion",
        value: s.reducedMotion ? "ON" : "OFF",
        color: s.reducedMotion ? "#00ff7a" : "#888888",
        key:   "reducedMotion",
      },
    ];

    for (let i = 0; i < options.length; i++) {
      const opt   = options[i];
      const y     = panelY + 40 + i * 18;
      const sel   = i === this._cursor;
      const arrow = sel ? "> " : "  ";
      const line  = arrow + opt.label + ": " + opt.value;
      const tx    = Math.round((viewW - line.length * this.GLYPH_W) / 2);
      this._drawOutlined(line, tx, y, sel ? "#ffffff" : "#aaaaaa");
    }

    // Help text — "ENTER:toggle  ESC:back" = 22 chars × 10px = 220px, fits in 224px panel
    const help  = "ENTER:toggle  ESC:back";
    const txH   = Math.round((viewW - help.length * this.GLYPH_W) / 2);
    this._drawOutlined(help, txH, panelY + panelH - 14, "#556677");

    camera.on();
    noTint();
  }

  // ---- key handling (called by main.js) -----------------------------------

  handleKey(key) {
    const options = ["reducedMotion"];

    if (key === "ArrowUp" || key === "w") {
      this._cursor = (this._cursor - 1 + options.length) % options.length;
      return true;
    }
    if (key === "ArrowDown" || key === "s") {
      this._cursor = (this._cursor + 1) % options.length;
      return true;
    }
    if (key === "Enter" || key === " ") {
      const k = options[this._cursor];
      if (window.settings && k in window.settings) {
        window.settings[k] = !window.settings[k];
        saveSettings();
      }
      return true;
    }
    return false;
  }

  // ---- bitmap font helpers (same as MenuScreen / PauseScreen) ---------------

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
      image(
        fontImg,
        Math.round(x + i * this.GLYPH_W), Math.round(y),
        this.GLYPH_W, this.GLYPH_W,
        sx, sy, this.CELL, this.CELL,
      );
    }
  }
}
