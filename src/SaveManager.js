// src/SaveManager.js
// Single-slot save/load system using localStorage.

export class SaveManager {
  constructor(key = "gbda302_savegame_v2") {
    this.key = key;
  }

  save(data) {
    try {
      const snapshot = {
        leavesRescued: data.leavesRescued ?? 0,
        totalLeaves: data.totalLeaves ?? 0,
        elapsedMs: data.elapsedMs ?? 0,

        collectedLeafIndices: Array.isArray(data.collectedLeafIndices)
          ? [...data.collectedLeafIndices]
          : [],

        killedBoarIndices: Array.isArray(data.killedBoarIndices)
          ? [...data.killedBoarIndices]
          : [],

        health: data.health ?? 3,
        savedAt: Date.now(),
      };

      localStorage.setItem(this.key, JSON.stringify(snapshot));
      console.log("[SaveManager] Game saved:", snapshot);
      return true;
    } catch (e) {
      console.warn("[SaveManager] Save failed:", e);
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      return {
        leavesRescued: parsed.leavesRescued ?? 0,
        totalLeaves: parsed.totalLeaves ?? 0,
        elapsedMs: parsed.elapsedMs ?? 0,

        collectedLeafIndices: Array.isArray(parsed.collectedLeafIndices)
          ? parsed.collectedLeafIndices
          : [],

        killedBoarIndices: Array.isArray(parsed.killedBoarIndices)
          ? parsed.killedBoarIndices
          : [],

        health: parsed.health ?? 3,
        savedAt: parsed.savedAt ?? null,
      };
    } catch (e) {
      console.warn("[SaveManager] Load failed:", e);
      return null;
    }
  }

  hasSave() {
    return !!localStorage.getItem(this.key);
  }

  clear() {
    localStorage.removeItem(this.key);
  }
}
