// src/SaveManager.js
// Simple save/load system using localStorage.
//
// Saves a single "game save" slot containing the player's last
// completed run (leaves rescued, completion time, timestamp).
// Completely separate from HighScoreManager (which tracks the
// all-time leaderboard); SaveManager tracks the last session.

export class SaveManager {
  constructor(key = "gbda302_savegame_v1") {
    this.key = key;
  }

  // Persist a run snapshot to localStorage.
  // data: { leavesRescued, totalLeaves, elapsedMs }
  save(data) {
    try {
      const snapshot = {
        leavesRescued: data.leavesRescued ?? 0,
        totalLeaves:   data.totalLeaves   ?? 0,
        elapsedMs:     data.elapsedMs     ?? 0,
        savedAt:       Date.now(),
      };
      localStorage.setItem(this.key, JSON.stringify(snapshot));
      console.log("[SaveManager] Game saved:", snapshot);
      return true;
    } catch (e) {
      console.warn("[SaveManager] Save failed:", e);
      return false;
    }
  }

  // Load the saved snapshot, or null if nothing is saved.
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("[SaveManager] Load failed:", e);
      return null;
    }
  }

  // Returns true if a save slot exists.
  hasSave() {
    return !!localStorage.getItem(this.key);
  }

  // Delete the save slot.
  clear() {
    localStorage.removeItem(this.key);
  }
}
