import { loadEnvConfig } from "@next/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPolitiredTools } from "@/lib/mcp/register-tools";

loadEnvConfig(process.cwd());

async function startServer() {
  const server = new McpServer({
    name: "politired",
    version: "0.1.0",
  });

  // Local stdio transport gets all tools including ingest
  registerPolitiredTools(server, { includeIngest: true });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Politired MCP server connected over stdio.");
}

startServer().catch((error) => {
  console.error("Failed to start MCP server:");
  console.error(error);
  process.exit(1);
});
