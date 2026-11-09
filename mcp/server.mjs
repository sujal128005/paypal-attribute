#!/usr/bin/env node
// PayPal Attribute MCP server (stdio).
// Lets any MCP-capable AI agent make its product recommendations attributable and payable.
//
//   ATTRIBUTE_API_URL=https://your-host/api/v1 ATTRIBUTE_API_KEY=pa_test_… node mcp/server.mjs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API = (process.env.ATTRIBUTE_API_URL || "http://localhost:3000/api/v1").replace(/\/$/, "");
const KEY = process.env.ATTRIBUTE_API_KEY || "pa_test_demo_7kq2vx9mn4pr8st1wz";

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json;
}

const text = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const failure = (err) => ({ isError: true, content: [{ type: "text", text: `PayPal Attribute error: ${err.message}` }] });

const server = new McpServer({ name: "paypal-attribute", version: "1.0.0" });

server.registerTool(
  "search_sources",
  {
    title: "Search creator sources",
    description: "Find registered creator reviews, guides and videos you can cite when recommending a product. Cite these so the creators get paid if the shopper buys.",
    inputSchema: { query: z.string().describe("What the shopper is looking for"), product_id: z.string().optional() },
    annotations: { readOnlyHint: true },
  },
  async ({ query, product_id }) => {
    try {
      const qs = new URLSearchParams({ q: query, ...(product_id ? { product_id } : {}) });
      return text(await call("GET", `/sources?${qs}`));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "attribute_recommendation",
  {
    title: "Attribute a recommendation",
    description:
      "Call this right after you recommend products. Registers which creator sources you relied on and returns an attribution token plus numbered footnotes to show the shopper. Pass the token as purchase_units[].custom_id when creating the PayPal order.",
    inputSchema: {
      query: z.string().describe("The shopper's question"),
      answer: z.string().describe("Your answer, with [n] footnote markers").optional(),
      product_ids: z.array(z.string()).min(1),
      citations: z
        .array(z.object({ source_id: z.string().optional(), source_url: z.string().optional(), claim: z.string().optional(), product_ids: z.array(z.string()).optional() }))
        .min(1),
    },
  },
  async (args) => {
    try {
      return text(await call("POST", "/attributions", { ...args, answer: args.answer ?? "", channel: "mcp" }));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "get_attribution",
  {
    title: "Get attribution",
    description: "Look up an attribution token: its footnotes and any PayPal sales it produced, with the AI-scored split and payout status.",
    inputSchema: { token: z.string().startsWith("att_") },
    annotations: { readOnlyHint: true },
  },
  async ({ token }) => {
    try {
      return text(await call("GET", `/attributions/${encodeURIComponent(token)}`));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "get_creator_earnings",
  {
    title: "Creator earnings",
    description: "Earnings summary for a creator: paid via PayPal, on hold, reversed, citations.",
    inputSchema: { creator_id: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ creator_id }) => {
    try {
      return text(await call("GET", `/creators/${encodeURIComponent(creator_id)}/earnings`));
    } catch (e) {
      return failure(e);
    }
  },
);

await server.connect(new StdioServerTransport());
