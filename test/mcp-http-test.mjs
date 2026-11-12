// Runs the MCP server over streamable HTTP on a spare port and calls two tools with the SDK client.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "mystudio-http-"));
const port = 3390 + Math.floor(Math.random() * 500);
const proc = spawn(process.execPath, [join(root, "server/index.mjs"), "--http", String(port)], {
  env: { ...process.env, MYSTUDIO_DATA: join(dir, "store.json") },
  stdio: ["ignore", "ignore", "ignore"],
});
await new Promise((r) => setTimeout(r, 800));
const out = [];
try {
  const client = new Client({ name: "mystudio-http-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`)));
  const add = await client.callTool({ name: "add_task", arguments: { title: "HTTP test task" } });
  assert.equal(add.isError ?? false, false);
  const list = await client.callTool({ name: "list_tasks", arguments: {} });
  assert.ok(JSON.parse(list.content[0].text).count >= 1);
  const idea = await client.callTool({ name: "generate_idea", arguments: {} });
  assert.ok(JSON.parse(idea.content[0].text).idea);
  out.push("PASS http: initialize, add_task, list_tasks, generate_idea over /mcp");
  await client.close();
} catch (e) {
  out.push(`FAIL http: ${e.message.split("\n")[0]}`);
} finally {
  proc.kill();
  rmSync(dir, { recursive: true, force: true });
}
console.log(out.join("\n"));
process.exit(out.some((l) => l.startsWith("FAIL")) ? 1 : 0);
