# Demo video script (target 2:45, hard limit 3:00)

Record at 1440×900, browser zoom 100%, light mode. Click **Reset demo** before recording.
No music with copyright, no third-party logos on screen. Speak calmly; cut pauses in editing.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Landing page hero | "AI agents are becoming the storefront. You ask what to buy, you get one answer, and nobody clicks an affiliate link. The creators whose reviews made that answer trustworthy earn nothing. PayPal Attribute fixes that." |
| 0:15–0:45 | **Shop with AI** → click "Noise-cancelling headphones under $150…" → hover footnote [1] | "Here's a shopping agent. Every claim is footnoted to a real creator: Maya's commute test, Noor's lab measurements. On the right, the attribution receipt: a token that will travel inside the PayPal order." |
| 0:45–1:05 | Click **Buy with PayPal** → pay (sandbox) → success dialog | "The shopper pays with PayPal as usual. The token rides in the order's custom_id. On capture, AI scores how much each source influenced this purchase and splits the merchant's commission." |
| 1:05–1:45 | **Watch the attribution trace**. Scroll slowly through the timeline | "Every sale is fully explainable: the question, the citations, the PayPal order, the capture, AI influence scores, six risk checks, the exact split with a written reason for each creator, and the ledger on the right. Payouts wait for the return window…" → click **Release now** → "…then go out in one PayPal Payouts batch." |
| 1:45–2:00 | Click **Refund** on another trace (or this one) | "If the shopper returns the product, held payouts reverse automatically, and money already paid is clawed back from future earnings." |
| 2:00–2:15 | **Creators** → Maya → "Try a prompt injection" → Submit | "Creators connect PayPal and register content. Content that tries to manipulate AI agents is blocked before it can ever earn." |
| 2:15–2:30 | **Merchants** → grid search, chart, ask "Which creator drives the most sales?" | "Merchants see which creators and conversations drive AI sales, built on AG Grid and AG Charts, and only pay when a cited creator actually influenced a purchase." |
| 2:30–2:45 | **Developers** → playground → POST → Simulate purchase | "For PayPal, it's one API key: one call when the agent answers, one field on the order. There's a REST API, an OpenAPI spec, and an MCP server so any agent can plug in. PayPal Attribute: every AI answer has sources, and now every source gets paid." |

## Shots to capture for the Devpost gallery (3:2, e.g. 1500×1000)

1. Landing hero
2. Shop with AI: answer with footnotes and the attribution receipt
3. Checkout success with the split
4. Attribution trace: influence scores + risk checks
5. Attribution trace: split + payouts + ledger
6. Merchants dashboard (charts + grid)
7. Creators: blocked prompt injection
8. Developers: playground with response
