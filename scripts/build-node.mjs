// Bundles the self-hosted Node server (node/server.ts) into a single dependency-free file.
import { build } from "esbuild";

await build({
  entryPoints: ["node/server.ts"],
  outfile: "dist/node/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  tsconfig: "tsconfig.worker.json",
  minify: true,
  legalComments: "linked",
  // CommonJS dependencies inside an ESM bundle need a real `require`.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
