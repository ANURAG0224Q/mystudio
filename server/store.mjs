// Local JSON store used by the MCP server. One file, written atomically.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

export const config = JSON.parse(readFileSync(resolve(repoRoot, "config.json"), "utf8"));
export const ideas = JSON.parse(readFileSync(resolve(repoRoot, "ideas.json"), "utf8"));

// Override the data file with MYSTUDIO_DATA (used by the tests).
export const dataPath = process.env.MYSTUDIO_DATA || resolve(repoRoot, "data", "store.json");

function emptyStore() {
  return { tasks: [], notes: [] };
}

export function readStore() {
  if (!existsSync(dataPath)) return emptyStore();
  try {
    const s = JSON.parse(readFileSync(dataPath, "utf8"));
    return { tasks: Array.isArray(s.tasks) ? s.tasks : [], notes: Array.isArray(s.notes) ? s.notes : [] };
  } catch (e) {
    throw new Error(`Data file is not valid JSON: ${dataPath}`);
  }
}

export function writeStore(store) {
  mkdirSync(dirname(dataPath), { recursive: true });
  const tmp = `${dataPath}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, dataPath);
}

export function newId() {
  return randomBytes(6).toString("hex");
}
