# MyStudio (placeholder name)

A small free personal app: a task list, notes, and an idea generator. It is a static web app (plain HTML, CSS and JavaScript, saved in the browser) plus an MCP server that exposes the same features to an AI chat. No paid services.

The name lives in one place: `config.json` (`appName`). Change it there and the web app and the MCP server both pick it up.

## Run the web app

Open `index.html` in a browser, or serve the folder:

    python3 -m http.server 8000

Then visit http://localhost:8000. Tasks and notes are saved in this browser's local storage.

## Run the MCP server locally

Requires Node.js 18 or newer.

    npm install
    npm run mcp              # stdio, for desktop clients that start a local process
    npm run mcp:http         # streamable HTTP on http://localhost:3333/mcp

Data is stored in `data/store.json` (created on first write). Set `MYSTUDIO_DATA=/path/file.json` to use another file.

Tools: `list_tasks`, `add_task`, `complete_task`, `delete_task`, `add_note`, `get_notes`, `generate_idea`.

## Tests

    npm run test:mcp         # calls every tool over stdio with the MCP SDK client
    npm run test:http        # same server over streamable HTTP
    python3 test/web-test.py http://localhost:8000/   # headless Chromium: tasks, notes, ideas

## Add it as a connector

Claude Desktop (local, stdio): add this to `claude_desktop_config.json` (Settings > Developer > Edit Config), with the real path to this folder, then restart Claude Desktop:

    {
      "mcpServers": {
        "mystudio": {
          "command": "node",
          "args": ["/full/path/to/mystudio/server/index.mjs"]
        }
      }
    }

Claude on the web and ChatGPT custom connectors need a public HTTPS address for the MCP server. The local HTTP mode above is only reachable from your own computer, so those two need the server hosted somewhere. Connector support may need a paid plan on Claude's or ChatGPT's side; check their current plan pages before relying on it. This is not free there by default.

Status: the stdio and HTTP servers were tested with the MCP SDK client. Connecting to Claude Desktop or ChatGPT was not tested.
