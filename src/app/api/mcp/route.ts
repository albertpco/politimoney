/**
 * Remote MCP endpoint — Streamable HTTP transport (Web Standard).
 *
 * Stateless: each request gets a fresh McpServer + transport.
 * This works because every tool is a read-only JSON lookup.
 *
 * Clients connect via:  POST https://yoursite.com/api/mcp
 *
 * The ingest pipeline tool is excluded from this endpoint
 * (it's long-running and should only run locally or via cron).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerPolitiredTools } from "@/lib/mcp/register-tools";

export const dynamic = "force-dynamic";

// Optional bearer token for basic auth (set MCP_BEARER_TOKEN env var)
const BEARER_TOKEN = process.env.MCP_BEARER_TOKEN;

function unauthorized(): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Unauthorized" }, id: null },
    { status: 401 },
  );
}

function checkAuth(req: Request): boolean {
  if (!BEARER_TOKEN) return true;
  const header = req.headers.get("authorization");
  return header === `Bearer ${BEARER_TOKEN}`;
}

export async function POST(req: Request): Promise<Response> {
  if (!checkAuth(req)) return unauthorized();

  const server = new McpServer({
    name: "politimoney",
    version: "0.1.0",
  });

  registerPolitiredTools(server, { includeIngest: false });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session tracking
    enableJsonResponse: true, // prefer JSON over SSE for serverless compatibility
  });

  await server.connect(transport);

  const response = await transport.handleRequest(req);

  // Clean up after response is sent
  response.body
    ?.pipeTo(new WritableStream({ close() { transport.close(); server.close(); } }))
    .catch(() => { transport.close(); server.close(); });

  return response;
}

export async function GET(): Promise<Response> {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Use POST." }, id: null },
    { status: 405 },
  );
}

export async function DELETE(): Promise<Response> {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Stateless server — no sessions to delete." }, id: null },
    { status: 405 },
  );
}
