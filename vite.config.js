/* idea 94: ES modules + Vite bundle (prep for packaging).
   The game uses classic scripts with shared globals + load order, so this
   plugin emits js/*.js verbatim into the build output to keep dist runnable
   while still getting Vite's minified HTML/CSS and dev server. */
import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

const JS_FILES = ["config", "sfx", "world", "entities", "weapons", "render", "game", "meta", "steam"];

function emitClassicScripts() {
  return {
    name: "emit-classic-scripts",
    generateBundle() {
      for (const name of JS_FILES) {
        const src = fs.readFileSync(path.resolve(__dirname, "js", name + ".js"), "utf8");
        this.emitFile({ type: "asset", fileName: `js/${name}.js`, source: src });
      }
    },
  };
}

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: true,
  },
  plugins: [emitClassicScripts()],
  server: {
    port: 8123,
    open: true,
  },
});