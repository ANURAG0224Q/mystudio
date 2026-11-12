// MyStudio MCP server.
// stdio (default):  node server/index.mjs
// streamable HTTP:  node server/index.mjs --http [port]   (endpoint: /mcp, default port 3333)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config, ideas, readStore, writeStore, newId } from "./store.mjs";

const textResult = (value) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const errorResult = (message) => ({ content: [{ type: "text", text: message }], isError: true });

export function buildServer() {
  const server = new McpServer({ name: config.appName.toLowerCase(), version: "0.1.0" });

  server.registerTool(
    "list_tasks",
    {
      description: `List ${config.appName} tasks. Filter by status: open, done or all (default all).`,
      inputSchema: { status: z.enum(["open", "done", "all"]).optional() },
    },
    async ({ status = "all" }) => {
      const tasks = readStore().tasks.filter((t) =>
        status === "all" ? true : status === "done" ? t.done : !t.done
      );
      return textResult({ count: tasks.length, tasks });
    }
  );

  server.registerTool(
    "add_task",
    {
      description: `Add a task to ${config.appName}.`,
      inputSchema: { title: z.string().min(1).max(200) },
    },
    async ({ title }) => {
      const store = readStore();
      const task = { id: newId(), title: title.trim(), done: false, created: new Date().toISOString() };
      store.tasks.unshift(task);
      writeStore(store);
      return textResult({ added: task });
    }
  );

  server.registerTool(
    "complete_task",
    {
      description: `Mark a ${config.appName} task as done by its id.`,
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const store = readStore();
      const task = store.tasks.find((t) => t.id === id);
      if (!task) return errorResult(`No task with id ${id}.`);
      task.done = true;
      task.completed = new Date().toISOString();
      writeStore(store);
      return textResult({ completed: task });
    }
  );

  server.registerTool(
    "delete_task",
    {
      description: `Delete a ${config.appName} task by its id.`,
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const store = readStore();
      const before = store.tasks.length;
      store.tasks = store.tasks.filter((t) => t.id !== id);
      if (store.tasks.length === before) return errorResult(`No task with id ${id}.`);
      writeStore(store);
      return textResult({ deleted: id });
    }
  );

  server.registerTool(
    "add_note",
    {
      description: `Save a note in ${config.appName}.`,
      inputSchema: {
        text: z.string().min(1).max(5000),
        title: z.string().max(120).optional(),
      },
    },
    async ({ text, title = "" }) => {
      const store = readStore();
      const note = { id: newId(), title: title.trim(), body: text.trim(), created: new Date().toISOString() };
      store.notes.unshift(note);
      writeStore(store);
      return textResult({ added: note });
    }
  );

  server.registerTool(
    "get_notes",
    {
      description: `Get the most recent ${config.appName} notes, newest first.`,
      inputSchema: { limit: z.number().int().min(1).max(200).optional() },
    },
    async ({ limit = 20 }) => {
      const notes = readStore().notes.slice(0, limit);
      return textResult({ count: notes.length, notes });
    }
  );

  server.registerTool(
    "generate_idea",
    {
      description: `Pick a random project idea from the ${config.appName} idea list.`,
      inputSchema: {},
    },
    async () => {
      if (ideas.length === 0) return errorResult("The idea list is empty.");
      const idea = ideas[Math.floor(Math.random() * ideas.length)];
      return textResult({ idea });
    }
  );

  return server;
}

async function main() {
  const httpIdx = process.argv.indexOf("--http");
  if (httpIdx !== -1) {
    const port = Number(process.argv[httpIdx + 1]) || Number(process.env.PORT) || 3333;
    const sessions = new Map();
    const httpServer = createServer(async (req, res) => {
      if (!req.url.startsWith("/mcp")) {
        res.writeHead(404).end("Not found");
        return;
      }
      let body;
      if (req.method === "POST") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString("utf8");
        try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; }
      }
      const sid = req.headers["mcp-session-id"];
      let transport = sid ? sessions.get(sid) : undefined;
      if (!transport && req.method === "POST" && body && !sid) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => sessions.set(id, transport),
        });
        transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); };
        await buildServer().connect(transport);
      }
      if (!transport) {
        res.writeHead(400, { "content-type": "application/json" })
          .end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "No valid session" }, id: null }));
        return;
      }
      await transport.handleRequest(req, res, body);
    });
    httpServer.listen(port, () => {
      console.error(`${config.appName} MCP (streamable HTTP) on http://localhost:${port}/mcp`);
    });
    return;
  }
  await buildServer().connect(new StdioServerTransport());
  console.error(`${config.appName} MCP running on stdio`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
