# Multi-tool Agentic RAG with MCP

Three capabilities, each backed by an MCP server:
1. ChromaDB retrieval
2. Natural-language-to-SQL over read-only SQLite
3. Web search via Tavily

NL-to-SQL uses two internal operations (schema discovery and query execution).

## Setup (Windows PowerShell)
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
ollama pull llama3.2
python setup_demo.py
python ingest.py
uvicorn main:app --host 127.0.0.1 --port 8000
```
Set `AGENT_API_KEY` in `.env`. Set `TAVILY_API_KEY` to enable web search. The web tool returns a configuration message if no key is set. Swagger: http://127.0.0.1:8000/docs

Set `OLLAMA_MODEL=qwen3:8b` in `.env` to use the installed tool-calling model. Model calls, MCP requests, and external HTTP calls allow up to 300 seconds (five minutes) per operation. An agent response can take longer because it may require several model and tool calls.

Example request:
```json
{"question":"How many active employees are in Engineering?","top_k":4}
```
Send `X-API-Key` with the configured key.

## React chat frontend

The `frontend/` directory contains Nexus, a responsive React interface with Tailwind
CSS and a Three.js animated orb. Start the backend using the setup instructions
above, then run these commands in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). Click
**Connect API key** and enter the same `AGENT_API_KEY` configured in the backend
`.env`. The key and conversations are held only in browser memory and clear on
reload. The frontend never embeds your key in its source or build.

Vite proxies `/api/health` and `/api/agent/query` to `http://127.0.0.1:8000`, so no
CORS changes are needed. To use a different backend, set `AGENT_BACKEND_URL` in
the terminal before starting Vite. For example:

```powershell
$env:AGENT_BACKEND_URL = 'http://127.0.0.1:8001'
npm run dev
```

The chat shows real responses, Markdown, returned tool usage, and request timing.
Prompt cards fill the composer; Enter sends and Shift+Enter adds a line. Connection
settings also control retrieval `top_k`. The backend handles each question
independently; the conversation display does not add history to API requests.
Stopping a request stops waiting in the browser; it does not guarantee cancellation
of work already running on the backend. Service health is checked every 30 seconds
and does not verify individual external tools or the API key.

```powershell
npm run build
npm run preview
```

The production bundle is written to `frontend/dist/`. Vite preview includes the
same local API proxy. For production hosting, serve that directory and configure
a same-origin reverse proxy from `/api/*` to the FastAPI service (removing `/api`).
Use HTTPS for remote access. Three.js respects reduced-motion settings, pauses
animation when the tab is hidden, and has a CSS fallback when WebGL is unavailable.

## MCP tool tests

NL-to-SQL requests fetch the schema before running generated SQLite SQL. One
trailing semicolon, quoted table identifiers, and CTEs are supported. SQLite's
authorizer restricts reads to approved tables, and the connection remains read-only.
Rejected SQL is returned to the model for correction, with at most three failed
SQL attempts per request. Qwen3 thinking is disabled for these tool-calling requests
to reduce latency; model output is capped at 2,048 tokens per round.

```powershell
.\.venv\Scripts\python.exe -m unittest test_sql_regressions -v
.\.venv\Scripts\python.exe test_engineering_sql.py
```

The live Engineering regression writes generated SQL, actual MCP responses,
expected SQLite rows, and answer checks to `nl_sql_engineering_results.json`.

Run the three capabilities (four MCP operations) through real stdio sessions:

```powershell
.\.venv\Scripts\python.exe test_all_tools.py
```

The runner writes one consolidated `all_tools_mcp_results.json` containing discovery,
per-tool summaries, arguments, responses, timings, and each test's status. It covers
successful calls, SQL joins and row limits, retrieval, web search,
and invalid-input rejection. It uses the existing synthetic database and ingested
HR policy; run setup and ingestion first if these fixtures are missing. Live web
search requires network access and `TAVILY_API_KEY`.
No running FastAPI or Ollama service is needed for these direct MCP tests.

Exit codes: `0` means all passed, `1` means a test or server lifecycle failed,
and `2` means testing was blocked by missing configuration. The report is updated
after each test, and missing web credentials are reported as blocked, not passed.
Each run replaces the previous MCP report. Existing agent/API reports are separate
historical runs and are not included in this fresh MCP report.

## Important limitations
This is a learning baseline, not a certified production deployment. The database is synthetic. For real data, use a dedicated read-only database identity, restricted views/row-level permissions, auditing, and robust SQL validation. Use TLS, a real identity provider, rate limits, observability, secret management, and security testing before deployment.

The sample HR policy is generic and not an official policy of any employer. Web search results and retrieved documents are untrusted data. This project uses MCP Python SDK 1.x APIs (`FastMCP`, `ClientSession`, `stdio_client`).
