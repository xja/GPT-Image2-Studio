import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptsDir, "..");
const distDir = join(rootDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await cp(join(rootDir, "public"), distDir, { recursive: true });
await cp(join(rootDir, "lib"), join(distDir, "lib"), { recursive: true });
await copyFile(join(rootDir, "cloudflare-pages-worker.mjs"), join(distDir, "_worker.js"));

console.log(`Cloudflare Pages build written to ${distDir}`);
