// src/InputManager.js
// Input boundary (SYSTEM layer).
//
// Responsibilities:
// - Read keyboard state each frame
// - Provide a stable input snapshot object (holds + presses)
// - Centralize key mapping so WORLD code never touches kb directly
//
// Notes:
// - Requires p5play global `kb`

export class InputManager {
  constructor() {
    this._prevDown = {
      jump: false,
      attack: false,
      restart: false,
      debugToggle: false,
      enter: false,
      eKey: false,
      vKey: false,
      backspace: false,
      pause: false,
      settings: false,
      load: false,
      escape: false,
    };

    this._prevLetters = {};

    this._input = {
      // held
      left: false,
      right: false,

      // gameplay edge-triggered
      jumpPressed: false,
      attackPressed: false,
      restartPressed: false,
      debugTogglePressed: false,

      // existing win flow
      enterPressed: false,
      ePressed: false,
      vPressed: false,
      typedChar: null,
      backspacePressed: false,

      // menu / page flow
      pausePressed: false,
      settingsPressed: false,
      loadPressed: false,
      escapePressed: false,
    };
  }

  update() {
    if (typeof kb === "undefined" || !kb) {
      this._input.left = false;
      this._input.right = false;
      this._input.jumpPressed = false;
      this._input.attackPressed = false;
      this._input.restartPressed = false;
      this._input.debugTogglePressed = false;
      this._input.enterPressed = false;
      this._input.ePressed = false;
      this._input.vPressed = false;
      this._input.typedChar = null;
      this._input.backspacePressed = false;
      this._input.pausePressed = false;
      this._input.settingsPressed = false;
      this._input.loadPressed = false;
      this._input.escapePressed = false;
      return this._input;
    }

    // Holds
    const leftHeld = kb.pressing("a") || kb.pressing("left");
    const rightHeld = kb.pressing("d") || kb.pressing("right");

    // Down states
    const jumpDown = kb.pressing("w") || kb.pressing("up");
    const attackDown = kb.pressing("space");
    const restartDown = kb.pressing("r");
    const debugToggleDown = kb.pressing("t");
    const enterDown = kb.pressing("enter");
    const eDown = kb.pressing("e");
    const vDown = kb.pressing("v");
    const backspaceDown = kb.pressing("backspace");
    const pauseDown = kb.pressing("p");
    const settingsDown = kb.pressing("s");
    const loadDown = kb.pressing("l");
    const escapeDown = kb.pressing("escape");

    // Snapshot write
    this._input.left = leftHeld;
    this._input.right = rightHeld;

    this._input.jumpPressed = jumpDown && !this._prevDown.jump;
    this._input.attackPressed = attackDown && !this._prevDown.attack;
    this._input.restartPressed = restartDown && !this._prevDown.restart;
    this._input.debugTogglePressed =
      debugToggleDown && !this._prevDown.debugToggle;

    this._input.enterPressed = enterDown && !this._prevDown.enter;
    this._input.ePressed = eDown && !this._prevDown.eKey;
    this._input.vPressed = vDown && !this._prevDown.vKey;
    this._input.backspacePressed = backspaceDown && !this._prevDown.backspace;

    this._input.pausePressed = pauseDown && !this._prevDown.pause;
    this._input.settingsPressed = settingsDown && !this._prevDown.settings;
    this._input.loadPressed = loadDown && !this._prevDown.load;
    this._input.escapePressed = escapeDown && !this._prevDown.escape;

    // Typed character detection (A-Z)
    this._input.typedChar = null;
    for (let c = 65; c <= 90; c++) {
      const letter = String.fromCharCode(c).toLowerCase();
      const isDown = kb.pressing(letter);
      const wasDown = this._prevLetters[letter] ?? false;
      if (isDown && !wasDown) {
        this._input.typedChar = String.fromCharCode(c);
      }
      this._prevLetters[letter] = isDown;
    }

    // Save previous down states
    this._prevDown.jump = jumpDown;
    this._prevDown.attack = attackDown;
    this._prevDown.restart = restartDown;
    this._prevDown.debugToggle = debugToggleDown;
    this._prevDown.enter = enterDown;
    this._prevDown.eKey = eDown;
    this._prevDown.vKey = vDown;
    this._prevDown.backspace = backspaceDown;
    this._prevDown.pause = pauseDown;
    this._prevDown.settings = settingsDown;
    this._prevDown.load = loadDown;
    this._prevDown.escape = escapeDown;

    return this._input;
  }

  get input() {
    return this._input;
  }
}
