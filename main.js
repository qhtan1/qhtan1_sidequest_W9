// main.js
// Sketch entry point (VIEW + orchestration layer).
//
// Responsibilities:
// - Load tuning.json and levels.json via LevelLoader
// - Preload assets (images, animations, audio, parallax layers)
// - Create Canvas and configure pixel-perfect rendering
// - Instantiate and wire core systems (Game + input/sound/debug)
// - Draw VIEW elements (background colour, parallax, HUD composite)
// - Own VIEW setup: canvas size, integer scaling, parallax draw, HUD composite
// - Boot the WORLD: load JSON, preload assets, create Game + systems
//
// Non-goals:
// - Does NOT implement gameplay rules (WORLD logic lives in Level/entities)
// - Does NOT manage camera logic inside world update (VIEW modules do)
// - Does NOT contain entity behavior or physics setup beyond global world settings
//
// Architectural notes:
// - main.js owns VIEW setup (canvas sizing, scaling, parallax, background colour).
// - Game owns WORLD orchestration (EventBus, Level lifecycle, system wiring).
// - world.autoStep = false for stable pixel rendering; world.step() happens during world update.
//
// Important:
// - This file is loaded as a JS module (type="module").
// - In module scope, p5 will NOT automatically find setup/draw.
//   We MUST attach setup/draw (and input callbacks) to window.
//
// Notes:
// - Browsers block audio autoplay. We unlock audio on the first click/key press.
//
// Dependencies (loaded in index.html before this file):
// - p5.js
// - p5.sound (optional but required for loadSound)
// - p5play

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
import { MenuScreen } from "./src/ui/MenuScreen.js";
import { PauseScreen } from "./src/ui/PauseScreen.js";
import { LoadScreen } from "./src/ui/LoadScreen.js";
import { DebugMenu } from "./src/ui/DebugMenu.js";
import { SettingsScreen, initSettings } from "./src/ui/SettingsScreen.js";

/* -----------------------------------------------------------
   HIGH SCORE SYSTEM
   -----------------------------------------------------------
   System responsible for persisting leaderboard data locally
   using localStorage. It is initialized here and injected into
   Game so WORLD logic can submit scores when a level completes.
----------------------------------------------------------- */

import { HighScoreManager } from "./src/HighScoreManager.js";
import { SaveManager } from "./src/SaveManager.js";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

// p5 loadJSON is callback-based. This wrapper lets us use async/await reliably.
function loadJSONAsync(url) {
  return new Promise((resolve, reject) => {
    loadJSON(url, resolve, reject);
  });
}

// Browsers block audio until a user gesture.
// We unlock it once and never think about it again.
let audioUnlocked = false;
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (typeof userStartAudio === "function") userStartAudio();
}

// Prevent the browser from stealing keys (space/arrows) for scrolling.
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
// State (WORLD + VIEW glue)
// ------------------------------------------------------------

let game; // WORLD orchestrator (updates + draws world)
let parallax; // VIEW background parallax
let hudGfx; // VIEW overlay buffer (screen-space)

let tuningDoc; // Data: tuning.json
let levelPkg; // Data package from LevelLoader (level + view + world + tiles)
let assets; // Preloaded assets bundle

let cameraController; // VIEW: follow + clamp camera to world bounds
let inputManager; // SYSTEM: keyboard snapshot
let soundManager; // SYSTEM: audio registry
let debugOverlay; // VIEW/SYSTEM: debug UI
const AUTO_START_KEY = "w9_autostart_after_reload";
let hasStartedOnce = false;

// Global debug state (shared by DebugMenu and WORLD logic)
window.debugState = {
  boarProbes: false,
  collisionBoxes: false,
  playerInvincible: false,
  winScoreOne: false,
};
let debugMenu;

/* -----------------------------------------------------------
   HIGH SCORE SYSTEM STATE
----------------------------------------------------------- */

let highScoreManager;
let saveManager;
let seedHighScores;

let winScreen;
let loseScreen;
let menuScreen;
let pauseScreen;
let loadScreen;
let settingsScreen;
let parallaxLayers = []; // Preloaded parallax layer defs [{ img, factor }, ...]

// Page state machine: "menu" | "playing"
// (win/lose/pause/load are overlays drawn on top of "playing", not separate states)
let gameState = "menu";

// Settings overlay flag: true while settings panel is open over the menu
let settingsOpen = false;

// Pause flag (separate from debug menu pause)
let gamePaused = false;

// Load-screen overlay flag: true while the "LOAD SAVE" panel is open
let gameLoading = false;

// Track whether game.build() has been called at least once
// (ESC resets this to false so re-entering always gets a fresh world)
let gameBuilt = false;

// Brief on-screen notification (e.g. "SAVED!" / "LOADED: ...")
let _notifText = "";
let _notifFrames = 0;
function _showNotif(text, frames = 120) {
  _notifText = text;
  _notifFrames = frames;
}

// Format milliseconds as MM:SS.hs (reused for notifications)
function _fmtMs(ms) {
  ms = Number(ms) || 0;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const hs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(hs).padStart(2, "0")}`;
}

// Make URLs absolute so they can’t accidentally resolve relative to /src/...
const LEVELS_URL = new URL("./data/levels.json", window.location.href).href;
const TUNING_URL = new URL("./data/tuning.json", window.location.href).href;

// This must match a level id in levels.json
const START_LEVEL_ID = "ffa_level1";

// Boot flags
let bootStarted = false;
let bootDone = false;

// ------------------------------------------------------------
// Boot pipeline (async) — runs from setup()
// ------------------------------------------------------------

async function boot() {
  console.log("BOOT: start");

  // --- Data ---
  tuningDoc = await loadJSONAsync(TUNING_URL);

  /* -----------------------------------------------------------
     Load High Score Seed Data

     This JSON file provides default leaderboard entries for
     first-time players. The HighScoreManager will copy this
     data into localStorage ONLY if storage is empty.
  ----------------------------------------------------------- */

  seedHighScores = await loadJSONAsync("./data/highscores.json");

  const loader = new LevelLoader(tuningDoc);
  levelPkg = await loader.load(LEVELS_URL, START_LEVEL_ID);

  // --- Assets (images/animations/etc.) ---
  assets = await loadAssets(levelPkg, tuningDoc);

  // --- Audio registry ---
  // (AudioContext may still be locked until the user clicks/presses a key.)
  soundManager = new SoundManager();

  /* -----------------------------------------------------------
     HIGH SCORE SYSTEM INITIALIZATION

     Creates the persistence system for leaderboards.
     The seed JSON is only applied the first time the game
     runs in a browser.
  ----------------------------------------------------------- */

  highScoreManager = new HighScoreManager("gbda302_highscores_v2", {
    maxEntries: 5,
    seed: seedHighScores,
    defaultLevelId: levelPkg?.level?.id ?? "ex5_level1",
  });

  // --- Parallax layer defs (VIEW) ---
  const defs = levelPkg.level?.view?.parallax ?? [];
  parallaxLayers = defs
    .map((d) => ({
      img: loadImage(d.img),
      factor: Number(d.speed ?? 0),
    }))
    .filter((l) => l.img);

  // Now that all data is ready, build the WORLD + VIEW runtime.
  initRuntime();

  bootDone = true;
  console.log("BOOT: done");
}

// ------------------------------------------------------------
// Runtime init (sync) — called after boot() finishes
// ------------------------------------------------------------

function initRuntime() {
  const { viewW, viewH } = levelPkg.view;

  // Resize the tiny placeholder canvas created in setup().
  resizeCanvas(viewW, viewH);

  // Pixel art: never smooth, never retina-scale the main canvas.
  pixelDensity(1);
  noSmooth();
  drawingContext.imageSmoothingEnabled = false;

  // Keep timing stable (p5play anims feel best when p5 is targeting 60).
  frameRate(60);

  // Pixel-perfect scaling to fill the browser window by integer multiples.
  applyIntegerScale(viewW, viewH);
  installResizeHandler(viewW, viewH);

  // Sprite rendering
  allSprites.pixelPerfect = true;

  // Physics: manual step for stable pixel rendering
  world.autoStep = false;

  // HUD buffer (screen-space)
  hudGfx = createGraphics(viewW, viewH);
  hudGfx.noSmooth();
  hudGfx.pixelDensity(1);

  // Systems
  inputManager = new InputManager();
  debugOverlay = new DebugOverlay();
  debugMenu = new DebugMenu(window.debugState);

  // WORLD
  game = new Game(levelPkg, assets, {
    hudGfx,
    inputManager,
    soundManager,
    debugOverlay,

    /* -------------------------------------------------------
       Inject High Score System into Game

       Game can now:
       - submit scores
       - check leaderboards
       - trigger name entry screens
    ------------------------------------------------------- */

    highScores: highScoreManager,
  });

  // Save/load system (single slot, localStorage)
  saveManager = new SaveManager();

  // Auto-save when the player wins a run
  game.events.on("level:won", () => {
    // Small delay so game state (elapsedMs, level) is fully latched
    setTimeout(() => {
      const lvl = game.level;
      saveManager.save({
        leavesRescued: lvl?.score ?? 0,
        totalLeaves: lvl?.WIN_SCORE ?? 0,
        elapsedMs: game.elapsedMs ?? 0,
        collectedLeafIndices: [...(lvl?.collectedLeafIndices ?? [])],
        killedBoarIndices: [...(lvl?.killedBoarIndices ?? [])],
        health: lvl?.player?.health ?? lvl?.player?.maxHealth ?? 3,
      });
    }, 100);
  });

  // NOTE: game.build() is intentionally deferred until the player presses
  // Enter on the menu screen. Building the world creates p5play sprites
  // which auto-render every frame — calling build() here would make boars,
  // leaves, fire, etc. bleed through the menu panel.

  // Accessibility settings (loads from localStorage, exposes window.settings)
  initSettings();

  // UI overlays
  winScreen = new WinScreen(levelPkg, assets);
  loseScreen = new LoseScreen(levelPkg, assets);
  menuScreen = new MenuScreen(levelPkg, assets);
  pauseScreen = new PauseScreen(levelPkg, assets);
  loadScreen = new LoadScreen(levelPkg, assets);
  settingsScreen = new SettingsScreen(levelPkg, assets);

  // VIEW: camera follow + clamp (target set after build())
  cameraController = new CameraController(levelPkg);

  // IMPORTANT: subscribe ONCE (not in draw)
  game.events.on("level:restarted", () => {
    cameraController?.setTarget(game.level?.playerCtrl?.sprite);
    cameraController?.reset();
  });

  // VIEW: parallax background renderer
  parallax = new ParallaxBackground(parallaxLayers);

  setAllSpritesVisible(false);
  loop();

  // If we intentionally reloaded to start a fresh run, do it immediately
  if (sessionStorage.getItem(AUTO_START_KEY) === "1") {
    sessionStorage.removeItem(AUTO_START_KEY);
    createFreshRun();
    setAllSpritesVisible(true);
    gamePaused = false;
    gameLoading = false;
    gameState = "playing";
  }
}

function createFreshRun() {
  // Clean old level listeners if present
  game?.level?.destroy?.();

  // Remove all existing p5play sprites
  allSprites.remove();

  // Build a brand-new Game instance
  inputManager = new InputManager();

  game = new Game(levelPkg, assets, {
    hudGfx,
    inputManager,
    soundManager,
    debugOverlay,
    highScores: highScoreManager,
  });

  game.build();

  // Re-create auto-save hook for this new game instance
  game.events.on("level:won", () => {
    setTimeout(() => {
      const lvl = game.level;
      saveManager.save({
        leavesRescued: lvl?.score ?? 0,
        totalLeaves: lvl?.WIN_SCORE ?? 0,
        elapsedMs: game.elapsedMs ?? 0,
        collectedLeafIndices: [...(lvl?.collectedLeafIndices ?? [])],
        killedBoarIndices: [...(lvl?.killedBoarIndices ?? [])],
        health: lvl?.player?.health ?? lvl?.player?.maxHealth ?? 3,
      });
    }, 100);
  });

  // Re-create camera reset hook for this new game instance
  game.events.on("level:restarted", () => {
    cameraController?.setTarget(game.level?.playerCtrl?.sprite);
    cameraController?.reset();
  });

  world.autoStep = false;
  cameraController.setTarget(game.level.playerCtrl.sprite);
  cameraController.reset();

  gameBuilt = true;
  hasStartedOnce = true;
}

function setAllSpritesVisible(isVisible) {
  for (const s of allSprites) {
    s.visible = isVisible;
  }
}

function restartViaReload() {
  sessionStorage.setItem(AUTO_START_KEY, "1");
  window.location.reload();
}

function hideHelperSprites() {
  for (const s of allSprites) {
    // Hide thin sensor/probe bars or untextured helper sprites
    const hasAnimation = !!s.ani;
    const hasImage =
      !!s.img || !!s.image || !!s.animation || !!s.spriteSheet || !!s._ani;

    const thinHorizontalBar =
      Number(s.w ?? 0) >= 10 && Number(s.h ?? 0) > 0 && Number(s.h ?? 0) <= 4;

    const tinyHelper =
      Number(s.w ?? 0) <= 4 &&
      Number(s.h ?? 0) <= 4 &&
      !hasAnimation &&
      !hasImage;

    const looksLikeProbeByName =
      typeof s.name === "string" && /probe|sensor|helper|ground/i.test(s.name);

    if (
      (!hasAnimation && !hasImage && thinHorizontalBar) ||
      tinyHelper ||
      looksLikeProbeByName
    ) {
      s.visible = false;
    }
  }
}

// ------------------------------------------------------------
// p5 lifecycle (module-safe)
// ------------------------------------------------------------

function setup() {
  // Create a tiny placeholder canvas immediately so p5 is happy,
  // then pause the loop until our async boot finishes.
  new Canvas(10, 10, "pixelated");
  pixelDensity(1);
  noLoop();

  if (bootStarted) return;
  bootStarted = true;

  boot().catch((err) => {
    console.error("BOOT FAILED:", err);
    // loop stays stopped so the sketch doesn't spam errors
  });
}

function draw() {
  if (!bootDone || !levelPkg || !game) return;

  const viewW = levelPkg.view.viewW;
  const viewH = levelPkg.view.viewH;

  // Background colour is per-level in levels.json: level.view.background
  const bg = levelPkg.level?.view?.background ?? [69, 61, 79];
  background(bg[0], bg[1], bg[2]);

  // Collision box debug toggle
  allSprites.debug = !!(window.debugState && window.debugState.collisionBoxes);

  // ---- MENU PAGE ----
  if (gameState === "menu") {
    menuScreen?.draw({
      topScores: highScoreManager?.getTop(START_LEVEL_ID) ?? [],
      savedGame: saveManager?.load() ?? null,
      showSettingsHint: true,
    });

    // Settings overlay on top of menu
    if (settingsOpen) {
      settingsScreen?.draw();
    }

    // Enter key → build world and start the game (blocked while settings open)
    if (inputManager) {
      inputManager.update();
      if (!settingsOpen && inputManager.input.enterPressed) {
        if (!hasStartedOnce) {
          createFreshRun();
          setAllSpritesVisible(true);
          gamePaused = false;
          gameLoading = false;
          gameState = "playing";
        } else {
          restartViaReload();
        }
      }
    }
    return; // skip world update + draw while on menu
  }

  // ---- PLAYING PAGE ----

  // Parallax uses camera.x from previous frame (fine with manual stepping)
  parallax?.draw({
    cameraX: camera.x || 0,
    viewW,
    viewH,
  });

  // Pause game update if paused, loading, or debug menu is open
  const isPaused = gamePaused || !!window.gamePaused; // true pause (P key / debug)
  const isLoading = gameLoading; // load-screen overlay
  if (!isPaused && !isLoading) {
    game.update();
    hideHelperSprites();
  } else {
    hideHelperSprites();
    for (const s of allSprites) {
      // Always zero velocities so sprites don't drift while frozen
      if (s.vel) {
        s.vel.x = 0;
        s.vel.y = 0;
      }
      // Only freeze animations on a real P-key pause, NOT the load overlay.
      // This way animations are still running when load confirms, so no re-enable needed.
      if (isPaused && s.ani) s.ani.playing = false;
    }
  }

  // VIEW: camera follow + clamp (after update so player position is current)
  cameraController?.update({
    viewW,
    viewH,
    levelW: game.level.bounds.levelW,
    levelH: game.level.bounds.levelH,
  });
  cameraController?.applyToP5Camera();

  // Check terminal state for HUD/overlay decisions
  const won = game?.won === true || game?.level?.won === true;
  const dead = game?.lost === true || game?.level?.player?.dead === true;
  const elapsedMs = Number(game?.elapsedMs ?? game?.level?.elapsedMs ?? 0);

  // WORLD draw + HUD composite (hide HUD on win/lose screens)
  game.draw({
    drawHudFn:
      won || dead
        ? null
        : () => {
            camera.off();
            try {
              drawingContext.imageSmoothingEnabled = false;
              imageMode(CORNER);
              image(hudGfx, 0, 0);
            } finally {
              camera.on();
              noTint();
            }
          },
  });

  // Draw debug menu overlay if enabled
  debugMenu?.draw();

  // Draw pause overlay (on top of game world, under win/lose/load screens)
  if (gamePaused && !won && !dead && !gameLoading) {
    pauseScreen?.draw();
  }

  // Draw load-save overlay (on top of everything except win/lose)
  if (gameLoading && !won && !dead) {
    loadScreen?.draw(saveManager?.load() ?? null);
  }

  if (won) {
    winScreen?.draw({
      elapsedMs,
      topScores: game.topScores,
    });
  }
  if (dead) loseScreen?.draw({ elapsedMs, game });

  // Brief save/load notification bar (fades out over last 30 frames)
  if (_notifFrames > 0) {
    _notifFrames--;
    const alpha =
      _notifFrames > 30 ? 255 : Math.floor((_notifFrames / 30) * 255);
    camera.off();
    push();
    noStroke();
    const msgW = _notifText.length * 7 + 14;
    const nx = Math.round((viewW - msgW) / 2);
    fill(0, 0, 0, alpha * 0.75);
    rect(nx, viewH - 26, msgW, 14, 3);
    textSize(9);
    textAlign(CENTER, CENTER);
    fill(0, 255, 130, alpha);
    text(_notifText, viewW / 2, viewH - 19);
    pop();
    camera.on();
    noTint();
  }
}

// ------------------------------------------------------------
// Optional input callbacks (audio unlock feels invisible)
// ------------------------------------------------------------

function mousePressed() {
  unlockAudioOnce();
}

function keyPressed(evt) {
  unlockAudioOnce();

  // Cheat: press \ to instantly win (for testing win screen)
  if (
    evt &&
    evt.key === "\\" &&
    gameState === "playing" &&
    game &&
    !game.won &&
    !game.lost
  ) {
    game.events?.emit("level:won");
    return false;
  }

  // R → full fresh restart from terminal states
  if (
    (evt?.key === "r" || evt?.key === "R") &&
    gameState === "playing" &&
    game &&
    (game.won || game.lost || game.level?.player?.dead)
  ) {
    restartViaReload();
    return false;
  }

  // O → open/close settings (from menu only)
  if (evt && (evt.key === "o" || evt.key === "O") && gameState === "menu") {
    settingsOpen = !settingsOpen;
    return false;
  }

  // When settings panel is open, route nav keys to it; ESC closes it
  if (settingsOpen && gameState === "menu") {
    if (evt && evt.key === "Escape") {
      settingsOpen = false;
      return false;
    }
    if (settingsScreen?.handleKey(evt?.key)) return false;
    return false;
  }

  // ESC → if load screen is open, close it; otherwise return to menu
  if (evt && evt.key === "Escape" && gameState === "playing") {
    if (gameLoading) {
      gameLoading = false;
      return false;
    }

    setAllSpritesVisible(false);
    gamePaused = false;
    gameLoading = false;
    gameState = "menu";
    return false;
  }

  // ENTER → if load screen is open, confirm the load
  if (evt && evt.key === "Enter" && gameLoading && gameState === "playing") {
    const sv = saveManager?.load();
    if (sv) {
      const savedKills = Array.isArray(sv.killedBoarIndices)
        ? sv.killedBoarIndices
        : [];
      game.level.killedBoarIndices = [...savedKills];

      game.restart({ preserveKills: true });
      world.autoStep = false;

      game.level.elapsedMs = sv.elapsedMs ?? 0;

      if (sv.health != null && game.level?.player) {
        game.level.player.health = Math.max(1, sv.health);
        game.level._lastHealth = null;
      }

      const savedIndices =
        Array.isArray(sv.collectedLeafIndices) &&
        sv.collectedLeafIndices.length > 0
          ? sv.collectedLeafIndices
          : Array.from({ length: sv.leavesRescued ?? 0 }, (_, i) => i);

      let restored = 0;
      if (game.level.leafSpawns) {
        for (const idx of savedIndices) {
          const item = game.level.leafSpawns[idx];
          if (!item?.s) continue;
          item.s.active = false;
          item.s.visible = false;
          item.s.y = -9999;
          restored++;
        }
        game.level.score = restored;
        game.level.collectedLeafIndices = [...savedIndices];
        game.level._lastScore = null;
      }

      _showNotif(
        `LOADED: ${sv.leavesRescued}/${sv.totalLeaves}  ${_fmtMs(sv.elapsedMs)}`,
      );
    }
    gameLoading = false;
    gamePaused = false;
    return false;
  }

  // S → manual save current run state
  if (
    (evt?.key === "s" || evt?.key === "S") &&
    gameState === "playing" &&
    !game.won &&
    !game.lost
  ) {
    const lvl = game.level;
    saveManager.save({
      leavesRescued: lvl?.score ?? 0,
      totalLeaves: lvl?.WIN_SCORE ?? 0,
      elapsedMs: game.elapsedMs ?? 0,
      collectedLeafIndices: [...(lvl?.collectedLeafIndices ?? [])],
      killedBoarIndices: [...(lvl?.killedBoarIndices ?? [])],
      health: lvl?.player?.health ?? lvl?.player?.maxHealth ?? 3,
    });
    _showNotif("SAVED!");
    return false;
  }

  // L → open the load-save overlay
  if (
    (evt?.key === "l" || evt?.key === "L") &&
    gameState === "playing" &&
    !gameLoading
  ) {
    gameLoading = true;
    gamePaused = false;
    return false;
  }

  // Pause toggle: P key
  if (evt && (evt.key === "p" || evt.key === "P")) {
    if (gameState === "playing" && game && !game.won && !game.lost) {
      gamePaused = !gamePaused;
      if (!gamePaused) {
        for (const s of allSprites) {
          if (s.ani) {
            s.ani.playing = true;
            s.ani.play?.();
          }
        }
      }
      return false;
    }
  }

  // Debug menu
  if (evt && (evt.key === "`" || evt.key === "Dead")) {
    debugMenu.toggle();
    return false;
  }

  if (window.gamePaused) {
    if (debugMenu?.enabled && debugMenu.handleInput(evt)) {
      return false;
    }
    return false;
  }

  return preventKeysThatScroll(evt);
}

// Extra safety: prevent scrolling even if p5 doesn’t route a key event you expect.
window.addEventListener(
  "keydown",
  (e) => {
    const k = (e.key ?? "").toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
    }
  },
  { passive: false },
);

// ------------------------------------------------------------
// IMPORTANT: expose p5 entrypoints in module scope
// ------------------------------------------------------------

window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.keyPressed = keyPressed;
