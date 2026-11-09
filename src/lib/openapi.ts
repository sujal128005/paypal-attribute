// OpenAPI 3.1 description of the public PayPal Attribute API.
// Served at /api/v1/openapi.json — import it into APIMatic to generate SDKs, or into Postman.
export function openApiSpec(serverUrl: string) {
  const err = { $ref: "#/components/responses/Error" };
  return {
    openapi: "3.1.0",
    info: {
      title: "PayPal Attribute API",
      version: "1.0.0",
      summary: "Attribution and payouts for AI-driven commerce.",
      description:
        "Register the creator sources behind an AI agent's product recommendation, carry the attribution token through PayPal checkout, and PayPal Attribute scores influence, splits commission and pays creators through PayPal Payouts.\n\nAuthenticate with `Authorization: Bearer pa_test_…`. All amounts are USD decimals.",
      license: { name: "MIT", identifier: "MIT" },
    },
    servers: [{ url: `${serverUrl}/api/v1`, description: "Sandbox" }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Attributions", description: "Register what an agent cited and get a token for checkout" },
      { name: "Sources", description: "Creator content that can be cited and paid" },
      { name: "Sales", description: "Captured sales, their AI-scored splits and payouts" },
      { name: "Creators", description: "Creator earnings" },
    ],
    paths: {
      "/attributions": {
        post: {
          tags: ["Attributions"],
          operationId: "createAttribution",
          summary: "Create an attribution",
          description: "Call this when your agent shows a recommendation. Pass the returned `token` as `purchase_units[].custom_id` when you create the PayPal order.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateAttributionRequest" }, example: { query: "noise cancelling headphones under $150", answer: "Get the Sonora Aura One [1]. Lab tests measured 31 dB of reduction [2].", product_ids: ["p_aura_one"], citations: [{ source_id: "src_maya_aura_review", claim: "Best ANC on a commute", product_ids: ["p_aura_one"] }, { source_url: "https://thegearlab.example/anc-measurements", claim: "31 dB measured reduction" }] } } } },
          responses: { "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Attribution" } } } }, "400": err, "401": err },
        },
        get: { tags: ["Attributions"], operationId: "listAttributions", summary: "List recent attributions for this API key", responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Attribution" } } } } } } }, "401": err } },
      },
      "/attributions/{token}": {
        get: {
          tags: ["Attributions"],
          operationId: "getAttribution",
          summary: "Retrieve an attribution and any sales it produced",
          parameters: [{ name: "token", in: "path", required: true, schema: { type: "string", pattern: "^att_" } }],
          responses: { "200": { description: "OK", content: { "application/json": { schema: { allOf: [{ $ref: "#/components/schemas/Attribution" }, { type: "object", properties: { sales: { type: "array", items: { $ref: "#/components/schemas/Sale" } } } }] } } } }, "404": err, "401": err },
        },
      },
      "/sources": {
        get: {
          tags: ["Sources"],
          operationId: "searchSources",
          summary: "Search citable creator content",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "Free-text query" },
            { name: "product_id", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Source" } } } } } } }, "401": err },
        },
        post: {
          tags: ["Sources"],
          operationId: "registerSource",
          summary: "Register creator content",
          description: "Content is screened (prompt injection, keyword stuffing, low information) before it can earn.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterSourceRequest" } } } },
          responses: { "201": { description: "Registered", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["active", "flagged", "blocked"] }, screening: { $ref: "#/components/schemas/Screening" } } } } } }, "400": err, "401": err },
        },
      },
      "/sales/{id}": {
        get: { tags: ["Sales"], operationId: "getSale", summary: "Retrieve a sale with its split and payouts", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Sale" } } } }, "404": err, "401": err } },
      },
      "/creators/{id}/earnings": {
        get: { tags: ["Creators"], operationId: "getCreatorEarnings", summary: "Creator earnings summary", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Earnings" } } } }, "404": err, "401": err } },
      },
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "pa_test_…" } },
      responses: { Error: { description: "Error", content: { "application/json": { schema: { type: "object", properties: { error: { type: "object", properties: { type: { type: "string" }, message: { type: "string" } }, required: ["type", "message"] } } } } } } },
      schemas: {
        CreateAttributionRequest: {
          type: "object",
          required: ["query", "product_ids", "citations"],
          properties: {
            query: { type: "string", description: "What the shopper asked" },
            answer: { type: "string", description: "What the agent answered, with footnote markers" },
            product_ids: { type: "array", items: { type: "string" }, minItems: 1 },
            citations: { type: "array", minItems: 1, items: { type: "object", properties: { source_id: { type: "string" }, source_url: { type: "string", format: "uri" }, claim: { type: "string" }, product_ids: { type: "array", items: { type: "string" } } } } },
            channel: { type: "string", enum: ["api", "mcp"], default: "api" },
          },
        },
        Footnote: { type: "object", properties: { n: { type: "integer" }, source_id: { type: "string" }, creator_id: { type: "string" }, creator: { type: "string" }, handle: { type: "string" }, title: { type: "string" }, url: { type: "string" }, kind: { type: "string" }, claim: { type: "string" } } },
        Attribution: {
          type: "object",
          properties: {
            token: { type: "string", example: "att_7XK2M9QP4RTV8WZ3NB" },
            status: { type: "string", enum: ["open", "converted", "expired"] },
            query: { type: "string" },
            answer: { type: "string" },
            product_ids: { type: "array", items: { type: "string" } },
            footnotes: { type: "array", items: { $ref: "#/components/schemas/Footnote" } },
            created_at: { type: "string", format: "date-time" },
            expires_at: { type: "string", format: "date-time" },
            checkout: { type: "object", properties: { custom_id: { type: "string" }, note: { type: "string" } } },
            warnings: { type: "array", items: { type: "string" } },
          },
        },
        Share: { type: "object", properties: { creator_id: { type: "string" }, influence: { type: "integer", minimum: 0, maximum: 100 }, share: { type: "number" }, amount: { type: "number" }, reason: { type: "string" }, excluded: { type: ["string", "null"] } } },
        Sale: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string", enum: ["created", "captured", "refunded"] },
            amount: { type: "object", properties: { value: { type: "string" }, currency: { type: "string" } } },
            attribution_token: { type: "string" },
            paypal: { type: "object", properties: { order_id: { type: ["string", "null"] }, capture_id: { type: ["string", "null"] }, mode: { type: "string" } } },
            split: { type: ["object", "null"], properties: { commission: { type: "number" }, platform_fee: { type: "number" }, creator_pool: { type: "number" }, engine: { type: "string" }, risk_decision: { type: "string" }, shares: { type: "array", items: { $ref: "#/components/schemas/Share" } } } },
            payouts: { type: "array", items: { type: "object", properties: { id: { type: "string" }, creator_id: { type: "string" }, amount: { type: "number" }, status: { type: "string", enum: ["held", "released", "sent", "failed", "reversed"] }, release_at: { type: "string" }, batch_id: { type: ["string", "null"] } } } },
          },
        },
        Source: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, url: { type: "string" }, kind: { type: "string" }, excerpt: { type: "string" }, product_ids: { type: "array", items: { type: "string" } }, creator: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, handle: { type: "string" } } } } },
        RegisterSourceRequest: { type: "object", required: ["creator_id", "title", "url", "kind", "excerpt", "categories"], properties: { creator_id: { type: "string" }, title: { type: "string" }, url: { type: "string", format: "uri" }, kind: { type: "string", enum: ["review", "video", "guide", "comparison", "podcast"] }, excerpt: { type: "string" }, categories: { type: "array", items: { type: "string", enum: ["audio", "running", "coffee", "camera", "home", "travel"] } }, product_ids: { type: "array", items: { type: "string" } } } },
        Screening: { type: "object", properties: { decision: { type: "string", enum: ["approved", "review", "blocked"] }, flags: { type: "array", items: { type: "string" } }, summary: { type: "string" }, engine: { type: "string" } } },
        Earnings: { type: "object", properties: { creator: { type: "object" }, currency: { type: "string" }, paid: { type: "number" }, pending: { type: "number" }, reversed: { type: "number" }, clawback_outstanding: { type: "number" }, citations: { type: "integer" }, attributed_sales: { type: "integer" } } },
      },
    },
  };
}

/** Postman v2.1 collection generated from the spec. */
export function postmanCollection(serverUrl: string, apiKey: string) {
  const spec = openApiSpec(serverUrl);
  const items: unknown[] = [];
  for (const [p, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops as Record<string, { summary: string; requestBody?: { content: { "application/json": { example?: unknown } } } }>)) {
      const pathSegs = p.replace(/^\//, "").split("/").map((s) => s.replace(/^\{(.+)\}$/, ":$1"));
      const example = op.requestBody?.content["application/json"].example;
      items.push({
        name: op.summary,
        request: {
          method: method.toUpperCase(),
          header: [{ key: "Content-Type", value: "application/json" }],
          url: { raw: `{{baseUrl}}/${pathSegs.join("/")}`, host: ["{{baseUrl}}"], path: pathSegs },
          ...(example ? { body: { mode: "raw", raw: JSON.stringify(example, null, 2), options: { raw: { language: "json" } } } } : {}),
        },
      });
    }
  }
  return {
    info: { name: "PayPal Attribute API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", description: spec.info.description },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{apiKey}}", type: "string" }] },
    variable: [
      { key: "baseUrl", value: `${serverUrl}/api/v1` },
      { key: "apiKey", value: apiKey },
    ],
    item: items,
  };
}
