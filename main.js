// main.js

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
// helpers
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
  if (typeof userStartAudio === "function") {
    userStartAudio();
  }
}

// ------------------------------------------------------------
// runtime state
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
// simple page state (Commit 1)
// ------------------------------------------------------------

const APP_PAGE = {
  MENU: "menu",
  GAME: "game",
};

let currentPage = APP_PAGE.MENU;

// ------------------------------------------------------------
// boot
// ------------------------------------------------------------

async function boot() {
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

  parallaxLayers = defs.map((d) => ({
    img: loadImage(d.img),
    factor: Number(d.speed ?? 0),
  }));

  initRuntime();

  bootDone = true;
}

// ------------------------------------------------------------
// init runtime
// ------------------------------------------------------------

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

  inputManager = new InputManager();

  debugOverlay = new DebugOverlay();

  debugMenu = new DebugMenu({
    boarProbes: false,
    collisionBoxes: false,
    playerInvincible: false,
    winScoreOne: false,
  });

  game = new Game(levelPkg, assets, {
    hudGfx,
    inputManager,
    soundManager,
    debugOverlay,
    highScores: highScoreManager,
  }).build();

  parallax = new ParallaxBackground(parallaxLayers, {
    viewW,
    viewH,
  });

  cameraController = new CameraController(levelPkg);

  winScreen = new WinScreen(levelPkg, assets);
  loseScreen = new LoseScreen(levelPkg, assets);

  currentPage = APP_PAGE.MENU;
}

// ------------------------------------------------------------
// menu page
// ------------------------------------------------------------

function drawMenuPage() {
  const viewW = levelPkg.view.viewW;
  const viewH = levelPkg.view.viewH;

  background(20, 20, 28);

  push();

  fill(0, 0, 0, 200);

  rect(20, 20, viewW - 40, viewH - 40, 8);

  fill(255);

  textAlign(CENTER, CENTER);

  textSize(20);

  text("FOREST RESCUE", viewW / 2, viewH / 2 - 30);

  textSize(10);

  text("Press ENTER to Start", viewW / 2, viewH / 2 + 10);

  pop();
}

// ------------------------------------------------------------
// p5 lifecycle
// ------------------------------------------------------------

window.setup = function () {
  createCanvas(240, 192);

  applyIntegerScale();

  installResizeHandler(applyIntegerScale);

  if (!bootStarted) {
    bootStarted = true;
    boot();
  }
};

window.draw = function () {
  if (!bootDone) return;

  inputManager.update();

  const input = inputManager.input;

  // MENU

  if (currentPage === APP_PAGE.MENU) {
    if (input.enterPressed) {
      currentPage = APP_PAGE.GAME;

      game.restart();
    }

    drawMenuPage();

    return;
  }

  // GAME

  const viewW = levelPkg.view.viewW;
  const viewH = levelPkg.view.viewH;

  background(0);

  const camX = cameraController.followX(game.level);

  parallax.draw(camX);

  cameraController.apply(game.level);

  game.update();

  game.draw({
    drawHudFn: () => {
      image(hudGfx, 0, 0);
    },
  });

  const won = game.won;
  const dead = game.level?.player?.dead;

  if (won) {
    winScreen.draw({
      elapsedMs: game.elapsedMs,
      topScores: game.topScores,
      awaitingName: game.awaitingName,
      nameEntry: game.nameEntry,
      nameCursor: game._nameCursor,
      blink: game._blink,
      lastRank: game.lastRank,
      winScreenState: game.winScreenState,
    });

    if (input.escapePressed) {
      currentPage = APP_PAGE.MENU;

      game.restart();
    }
  }

  if (dead) {
    loseScreen.draw({
      elapsedMs: game.elapsedMs,
      game,
    });

    if (input.escapePressed) {
      currentPage = APP_PAGE.MENU;

      game.restart();
    }
  }
};

window.keyPressed = function () {
  unlockAudioOnce();
};
