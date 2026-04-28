/**
 * Markdown system-prompt template that users can paste into Claude Desktop,
 * ChatGPT custom GPTs, n8n nodes, or any other LLM tool. Tells the model
 * how to call the Solid agent x402 endpoint.
 */
export const AGENT_PROMPT_TEMPLATE = `# Solid Agent Wallet — payment instructions

You can pay USDC to allowlisted recipients via the Solid Agent Wallet API. Use this when the user asks you to pay for a paid resource that supports the x402 payment standard.

## Authentication

Send every request with:

\`\`\`
Authorization: Bearer YOUR_SOLID_API_KEY
Content-Type: application/json
\`\`\`

## Endpoint

\`POST https://api.solid.xyz/v1/agents/me/x402-pay\`

## Request body

| Field | Type | Description |
| --- | --- | --- |
| \`resourceUrl\` | string | The merchant URL the payment unlocks. |
| \`amountUsdc\` | string | USDC amount in 6-decimal integer form. \`"100000"\` = $0.10. |
| \`recipient\` | string | EVM address. Must be in the user's allowlist. |
| \`description\` | string? | Optional human-readable note. |

## Constraints

- Recipient must already be on the user's allowlist. If you get a 403, ask the user to add the address from the Agent page first.
- Per-transaction cap and daily cap are enforced server-side. Daily resets at UTC midnight.
- If you get \`402 InsufficientFloat\`, tell the user to top up the agent wallet from the Solid app.

## Example

\`\`\`bash
curl -X POST https://api.solid.xyz/v1/agents/me/x402-pay \\
  -H "Authorization: Bearer YOUR_SOLID_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "resourceUrl": "https://api.example.com/paid-resource",
    "amountUsdc": "100000",
    "recipient": "0xMERCHANT_ADDRESS",
    "description": "Premium API call"
  }'
\`\`\`

A successful response returns \`{ "txHash", "settledAt", "activityId" }\` plus the merchant body. Settlement takes ~200ms via the Coinbase x402 facilitator.
`;

export const AGENT_INTEGRATION_CURL = (apiKeyHint = 'YOUR_SOLID_API_KEY') =>
  `curl -X POST https://api.solid.xyz/v1/agents/me/x402-pay \\
  -H "Authorization: Bearer ${apiKeyHint}" \\
  -H "Content-Type: application/json" \\
  -d '{"resourceUrl":"https://api.example.com/paid","amountUsdc":"100000","recipient":"0x..."}'`;
