// main.js
// Sketch entry point (VIEW + orchestration layer).

import { LevelLoader } from "./src/LevelLoader.js";
import { Game } from "./src/Game.js";
import { ParallaxBackground } from "./src/ParallaxBackground.js";
import { loadAssets } from "./src/AssetLoader.js";
import {
  applyIntegerScale,
  installResizeHandler,
} from "./src/utils/IntegerScale.js";

import { CameraController } from "./src/CameraController.js";
import { InputManager } from "./src/InputManager.js";
import { SoundManager } from "./src/SoundManager.js";
import { DebugOverlay } from "./src/DebugOverlay.js";

import { WinScreen } from "./src/ui/WinScreen.js";
import { LoseScreen } from "./src/ui/LoseScreen.js";
import { DebugMenu } from "./src/ui/DebugMenu.js";
import { HighScoreManager } from "./src/HighScoreManager.js";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function loadJSONAsync(url) {
  return new Promise((resolve, reject) => {
    loadJSON(url, resolve, reject);
  });
}

let audioUnlocked = false;
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (typeof userStartAudio === "function") userStartAudio();
}

function preventKeysThatScroll(evt) {
  const k = (evt?.key ?? "").toLowerCase();
  const scrollKeys = [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"];
  if (scrollKeys.includes(k)) {
    evt.preventDefault?.();
    return false;
  }
  return true;
}

// ------------------------------------------------------------
// Runtime state
// ------------------------------------------------------------

let game;
let parallax;
let hudGfx;

let tuningDoc;
let levelPkg;
let assets;

let cameraController;
let inputManager;
let soundManager;
let debugOverlay;

window.debugState = {
  boarProbes: false,
  collisionBoxes: false,
  playerInvincible: false,
  winScoreOne: false,
};
let debugMenu;

let highScoreManager;
let seedHighScores;

let winScreen;
let loseScreen;
let parallaxLayers = [];

const LEVELS_URL = new URL("./data/levels.json", window.location.href).href;
const TUNING_URL = new URL("./data/tuning.json", window.location.href).href;
const START_LEVEL_ID = "ex5_level1";

let bootStarted = false;
let bootDone = false;

// ------------------------------------------------------------
// App page state
// ------------------------------------------------------------

const APP_PAGE = {
  MENU: "menu",
  GAME: "game",
  GAMEOVER: "gameover",
  SETTINGS: "settings",
};

let currentPage = APP_PAGE.MENU;
let gameOverMode = null; // "win" | "lose"
let menuMessage = "";
let settingsMessage = "Accessibility menu coming next commit";

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------

async function boot() {
  console.log("BOOT: start");

  tuningDoc = await loadJSONAsync(TUNING_URL);
  seedHighScores = await loadJSONAsync("./data/highscores.json");

  const loader = new LevelLoader(tuningDoc);
  levelPkg = await loader.load(LEVELS_URL, START_LEVEL_ID);

  assets = await loadAssets(levelPkg, tuningDoc);

  soundManager = new SoundManager();

  highScoreManager = new HighScoreManager("gbda302_highscores_v2", {
    maxEntries: 5,
    seed: seedHighScores,
    defaultLevelId: levelPkg?.level?.id ?? "ex5_level1",
  });

  const defs = levelPkg.level?.view?.parallax ?? [];
  parallaxLayers = defs
    .map((d) => ({
      img: loadImage(d.img),
      factor: Number(d.speed ?? 0),
    }))
    .filter((l) => l.img);

  initRuntime();

  bootDone = true;
  console.log("BOOT: done");
}

function initRuntime() {
  const { viewW, viewH } = levelPkg.view;

  resizeCanvas(viewW, viewH);

  pixelDensity(1);
  noSmooth();
  drawingContext.imageSmoothingEnabled = false;
  frameRate(60);

  hudGfx = createGraphics(viewW, viewH);
  hudGfx.pixelDensity(1);
  hudGfx.noSmooth();
  hudGfx.clear();
  hudGfx.drawingContext.imageSmoothingEnabled = false;

  inputManager = new InputManager();
  debugOverlay = new DebugOverlay();
  debugMenu = new DebugMenu(window.debugState);

  game = new Game(levelPkg, assets, {
    hudGfx,
    inputManager,
    soundManager,
    debugOverlay,
    highScores: highScoreManager,
  }).build();

  window.game = game;

  parallax = new ParallaxBackground(parallaxLayers, {
    viewW,
    viewH,
  });

  cameraController = new CameraController(levelPkg);
  winScreen = new WinScreen(levelPkg, assets);
  loseScreen = new LoseScreen(levelPkg, assets);

  currentPage = APP_PAGE.MENU;
  gameOverMode = null;
}

// ------------------------------------------------------------
// Page helpers
// ------------------------------------------------------------

function startNewRun() {
  game.restart();
  gameOverMode = null;
  menuMessage = "";
  currentPage = APP_PAGE.GAME;
}

function openSettings() {
  currentPage = APP_PAGE.SETTINGS;
}

function returnToMenu() {
  currentPage = APP_PAGE.MENU;
}

function handlePageTransitions(input) {
  if (!bootDone || !game) return;

  if (currentPage === APP_PAGE.MENU) {
    if (input.enterPressed) {
      startNewRun();
      return;
    }

    if (input.loadPressed) {
      menuMessage = "Load will be implemented in a later commit";
      return;
    }

    if (input.settingsPressed) {
      openSettings();
      return;
    }
  }

  if (currentPage === APP_PAGE.SETTINGS) {
    if (input.escapePressed || input.enterPressed) {
      returnToMenu();
      return;
    }
  }

  if (currentPage === APP_PAGE.GAME) {
    if (game.won) {
      gameOverMode = "win";
      currentPage = APP_PAGE.GAMEOVER;
      return;
    }

    if (game.lost || game.level?.player?.dead) {
      gameOverMode = "lose";
      currentPage = APP_PAGE.GAMEOVER;
      return;
    }
  }

  if (currentPage === APP_PAGE.GAMEOVER) {
    if (input.restartPressed || input.enterPressed) {
      startNewRun();
      return;
    }

    if (input.escapePressed) {
      returnToMenu();
      return;
    }
  }
}

// ------------------------------------------------------------
// Drawing helpers
// ------------------------------------------------------------

function drawMenuPage() {
  const viewW = levelPkg?.view?.viewW ?? width;
  const viewH = levelPkg?.view?.viewH ?? height;

  background("#1b1e2b");

  push();
  noStroke();
  fill("#0f1220");
  rect(16, 16, viewW - 32, viewH - 32, 8);
  pop();

  push();
  textAlign(CENTER, CENTER);
  fill("#ffffff");

  textSize(20);
  text("FOREST RESCUE", viewW / 2, 42);

  textSize(11);
  text("ENTER - Start Game", viewW / 2, 88);
  text("L - Load Save", viewW / 2, 106);
  text("S - Settings", viewW / 2, 124);
  text("T - Debug Overlay", viewW / 2, 142);

  if (menuMessage) {
    fill("#ffd166");
    text(menuMessage, viewW / 2, 168);
  }
  pop();
}

function drawSettingsPage() {
  const viewW = levelPkg?.view?.viewW ?? width;
  const viewH = levelPkg?.view?.viewH ?? height;

  background("#182028");

  push();
  noStroke();
  fill("#0d1117");
  rect(16, 16, viewW - 32, viewH - 32, 8);
  pop();

  push();
  textAlign(CENTER, CENTER);
  fill("#ffffff");

  textSize(18);
  text("SETTINGS", viewW / 2, 42);

  textSize(11);
  text("This page is the shell for the bonus menu.", viewW / 2, 82);
  text(settingsMessage, viewW / 2, 100);
  text("ESC or ENTER - Back to Menu", viewW / 2, 136);
  pop();
}

function drawGamePage() {
  background(levelPkg?.level?.view?.background ?? "#87c7ff");

  const camX = cameraController?.followX?.(game.level) ?? 0;
  if (parallax) parallax.draw(camX);

  cameraController?.apply?.(game.level);
  game.draw({
    drawHudFn: () => {
      image(hudGfx, 0, 0);
    },
  });

  if (debugMenu?.enabled) {
    debugMenu.draw();
  }
}

function drawGameOverPage() {
  drawGamePage();

  if (gameOverMode === "win") {
    winScreen.draw({
      elapsedMs: game.elapsedMs,
      bestMs: game.bestMs,
      lastWinMs: game.lastWinMs,
      lastWinWasNewBest: game.lastWinWasNewBest,
      topScores: game.topScores,
      lastRank: game.lastRank,
      awaitingName: game.awaitingName,
      nameEntry: game.nameEntry,
      nameCursor: game._nameCursor,
      blink: game._blink,
      winScreenState: game.winScreenState,
    });
  } else {
    loseScreen.draw({
      elapsedMs: game.elapsedMs,
      bestMs: game.bestMs,
      lastWinMs: game.lastWinMs,
      lastWinWasNewBest: game.lastWinWasNewBest,
    });
  }

  push();
  textAlign(CENTER, CENTER);
  fill("#ffffff");
  textSize(10);
  text("ENTER/R - Restart    ESC - Menu", width / 2, height - 10);
  pop();
}

// ------------------------------------------------------------
// p5 lifecycle
// ------------------------------------------------------------

window.preload = function () {
  // Boot is async and starts in setup().
};

window.setup = function () {
  createCanvas(240, 192);
  pixelDensity(1);
  noSmooth();
  drawingContext.imageSmoothingEnabled = false;

  applyIntegerScale();
  installResizeHandler(applyIntegerScale);

  if (!bootStarted) {
    bootStarted = true;
    boot().catch((err) => {
      console.error("BOOT FAILED:", err);
    });
  }
};

window.draw = function () {
  if (!bootDone) {
    background(20);
    push();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(14);
    text("Loading...", width / 2, height / 2);
    pop();
    return;
  }

  inputManager.update();
  const input = inputManager.input;

  if (input.debugTogglePressed && debugOverlay) {
    debugOverlay.toggle();
  }

  handlePageTransitions(input);

  if (currentPage === APP_PAGE.GAME) {
    game.update();
    drawGamePage();
    return;
  }

  if (currentPage === APP_PAGE.GAMEOVER) {
    drawGameOverPage();
    return;
  }

  if (currentPage === APP_PAGE.SETTINGS) {
    drawSettingsPage();
    return;
  }

  drawMenuPage();
};

window.keyPressed = function (evt) {
  unlockAudioOnce();
  preventKeysThatScroll(evt);

  if (evt.key === "`" && debugMenu) {
    debugMenu.toggle();
    return false;
  }

  if (debugMenu?.enabled) {
    const handled = debugMenu.handleInput(evt);
    if (handled) return false;
  }

  return true;
};

window.mousePressed = function () {
  unlockAudioOnce();
};
