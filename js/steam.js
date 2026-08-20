/* ============================================================
   BLOB KNIGHT — Steamworks bridge (roadmap idea 96)
   Feature-flagged: when running inside a Steam build (steamworks.js
   injected by Tauri/preload), hooks achievements + cloud saves.
   In the browser it degrades silently to localStorage.
   ============================================================ */
const STEAM = (() => {
  const sw = (typeof window !== "undefined" && window.steamworks) || null;
  return {
    available: !!sw,
    /* idea 96: unlock an achievement if Steam is present */
    unlock(name) {
      if (sw && sw.achievement) {
        try { sw.achievement.activate(name); return true; } catch (e) { /* ignore */ }
      }
      return false;
    },
    /* idea 96: cloud saves — falls back to caller's localStorage save */
    save(data) {
      if (sw && sw.cloud) {
        try { sw.cloud.save("save.json", data); return true; } catch (e) { /* ignore */ }
      }
      return false;
    },
    load() {
      if (sw && sw.cloud) {
        try {
          const d = sw.cloud.read("save.json");
          return typeof d === "string" ? d : JSON.stringify(d);
        } catch (e) { /* ignore */ }
      }
      return null;
    },
  };
})();