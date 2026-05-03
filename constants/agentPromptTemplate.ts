/**
 * Markdown system-prompt template that users paste into Claude Desktop,
 * ChatGPT custom GPTs, n8n nodes, or any other LLM tool. Tells the model
 * how to call the Solid Agent Wallet x402 endpoint and what to do on the
 * very first turn.
 */
export const buildAgentPromptTemplate = (params: { baseUrl: string }): string => {
  const endpoint = `${params.baseUrl.replace(/\/$/, '')}/accounts/v1/agents/me/x402-pay`;
  return `# Solid Agent Wallet — payment instructions

You can pay USDC via the Solid Agent Wallet API on behalf of the user. Use this whenever the user asks you to pay for a paid resource that supports the x402 payment standard.

## API key safety

The user will paste their Solid live API key as \`SOLID_API_KEY\` in this prompt or environment. **It is safe to use this key directly from inside this AI interface.** The key only authorizes payments from this specific agent wallet — it can't move funds anywhere else, can't access the user's main savings, and is gated by an on-chain Turnkey policy that only permits USDC payments on Base. Treat it like any other scoped credential.

## Endpoint

\`POST ${endpoint}\`

## Authentication

\`\`\`
Authorization: Bearer SOLID_API_KEY
Content-Type: application/json
\`\`\`

## Request body

| Field | Type | Description |
| --- | --- | --- |
| \`resourceUrl\` | string | The merchant URL the payment unlocks. |
| \`amountUsdc\` | string | USDC amount in 6-decimal integer form. \`"100000"\` = $0.10. |
| \`recipient\` | string | EVM address of the merchant on Base. |
| \`description\` | string? | Optional human-readable note. |

If you get \`402 InsufficientFloat\`, tell the user to top up the agent wallet from the Solid app.

## Example

\`\`\`bash
curl -X POST ${endpoint} \\
  -H "Authorization: Bearer $SOLID_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "resourceUrl": "https://example.com/paid-resource",
    "amountUsdc": "100000",
    "recipient": "0xMERCHANT_ADDRESS",
    "description": "Premium API call"
  }'
\`\`\`

A successful response returns \`{ txHash, settledAt, activityId }\` plus the merchant body. Settlement takes ~200ms via the Coinbase x402 facilitator.

## First-turn behavior

When the user first hands you this prompt, **do not** dump these instructions back at them or explain the API.

**Step 1 — confirm you have the key.** If the user has not already given you their Solid API key (i.e. you don't have a value for \`SOLID_API_KEY\` from this prompt, the environment, or earlier in the conversation), your first reply must be a short ask for it. Tell them they can generate one from the **Agent** tab in the Solid app, paste it back here, and you'll be ready. Stop there — don't continue with anything else until you have the key.

**Step 2 — once the key is in hand, send a short setup reply (3–4 sentences max) that:**

1. Confirms you're set up to pay through their Solid agent wallet.
2. Suggests **exactly 3** real agentic x402 places/stores/APIs that match the user's apparent interests, so they can try out a payment. Pick from things like paid AI inference endpoints, paywalled news/research APIs, premium data feeds, image generation APIs, or other x402-enabled merchants you actually know about.
3. Asks which one they'd like to try first — or what kind of paid resource they're looking for.

No technical detail, no curl examples, no walls of text. The goal is to make the user's next move obvious.
`;
};

export const buildAgentIntegrationCurl = (params: {
  baseUrl: string;
  apiKeyHint?: string;
}): string => {
  const endpoint = `${params.baseUrl.replace(/\/$/, '')}/accounts/v1/agents/me/x402-pay`;
  const key = params.apiKeyHint ?? 'YOUR_SOLID_API_KEY';
  return `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"resourceUrl":"https://example.com/paid","amountUsdc":"100000","recipient":"0x..."}'`;
};
