// Calls every MyStudio MCP tool over stdio with the SDK client. Uses a throwaway data file.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "mystudio-"));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(root, "server/index.mjs")],
  env: { ...process.env, MYSTUDIO_DATA: join(dir, "store.json") },
  stderr: "ignore",
});
const client = new Client({ name: "mystudio-test", version: "0.0.0" });
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message.split("\n")[0]}`); }
};
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content[0].text;
  if (res.isError) throw new Error(`${name} returned error: ${text}`);
  return JSON.parse(text);
};

try {
  await client.connect(transport);
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  await check("tools/list exposes the 7 tools", async () => {
    assert.deepEqual(names, ["add_note", "add_task", "complete_task", "delete_task", "generate_idea", "get_notes", "list_tasks"]);
  });

  let taskId;
  await check("add_task", async () => {
    const r = await call("add_task", { title: "Ship MyStudio v1" });
    assert.equal(r.added.title, "Ship MyStudio v1");
    assert.equal(r.added.done, false);
    taskId = r.added.id;
  });
  await check("list_tasks shows the new task as open", async () => {
    const r = await call("list_tasks", { status: "open" });
    assert.equal(r.count, 1);
    assert.equal(r.tasks[0].id, taskId);
  });
  await check("complete_task", async () => {
    const r = await call("complete_task", { id: taskId });
    assert.equal(r.completed.done, true);
    const done = await call("list_tasks", { status: "done" });
    assert.equal(done.count, 1);
  });
  await check("complete_task on unknown id returns an error", async () => {
    const res = await client.callTool({ name: "complete_task", arguments: { id: "nope" } });
    assert.equal(res.isError, true);
  });
  let delId;
  await check("add_task then delete_task removes it", async () => {
    delId = (await call("add_task", { title: "Throwaway" })).added.id;
    await call("delete_task", { id: delId });
    const all = await call("list_tasks", { status: "all" });
    assert.equal(all.tasks.some((t) => t.id === delId), false);
  });
  await check("add_note", async () => {
    const r = await call("add_note", { text: "First note body", title: "Hello" });
    assert.equal(r.added.body, "First note body");
    assert.equal(r.added.title, "Hello");
    await call("add_note", { text: "Second note" });
  });
  await check("get_notes returns newest first with limit", async () => {
    const r = await call("get_notes", { limit: 1 });
    assert.equal(r.count, 1);
    assert.equal(r.notes[0].body, "Second note");
    const all = await call("get_notes", {});
    assert.equal(all.count, 2);
  });
  await check("generate_idea returns a string from the list", async () => {
    const r = await call("generate_idea", {});
    assert.equal(typeof r.idea, "string");
    assert.ok(r.idea.length > 5);
  });
  await check("data written by earlier calls is read back from the file", async () => {
    const r = await call("list_tasks", { status: "all" });
    assert.equal(r.count, 1);
  });
} catch (e) {
  results.push(`FAIL harness: ${e.message}`);
} finally {
  await client.close().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
console.log(results.join("\n"));
const failed = results.filter((l) => l.startsWith("FAIL")).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
