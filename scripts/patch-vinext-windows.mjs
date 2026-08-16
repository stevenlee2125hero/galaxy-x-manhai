import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

if (process.platform !== "win32") process.exit(0);

const target = path.resolve("node_modules/vinext/dist/server/static-file-cache.js");
const original = 'relativePath: path.relative(base, batch[j]),';
const patched = 'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),';

try {
  const source = await readFile(target, "utf8");
  if (source.includes(patched)) process.exit(0);
  if (!source.includes(original)) {
    console.warn("[postinstall] Vinext static path patch was not applied: target code changed.");
    process.exit(0);
  }
  await writeFile(target, source.replace(original, patched));
  console.log("[postinstall] Patched Vinext static asset paths for Windows.");
} catch (error) {
  console.warn(`[postinstall] Vinext Windows patch skipped: ${error.message}`);
}
