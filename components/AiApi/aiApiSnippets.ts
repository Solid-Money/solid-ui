/** The agents the setup tabs cover, in tab order. */
export type AiApiAgent = 'claude-code' | 'codex' | 'openclaw' | 'other';

export const AI_API_AGENT_TABS: { id: AiApiAgent; label: string }[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'openclaw', label: 'OpenClaw' },
  { id: 'other', label: 'Other' },
];

/** One code block in a setup guide. */
export interface AiApiSnippetBlock {
  /** What the block is: a shell, a config file's path. */
  label: string;
  /** What the block shows. A long key is shortened to keep the block readable. */
  display: string;
  /** What Copy puts on the clipboard: always the whole key. */
  copy: string;
}

export interface AiApiSetupGuide {
  blocks: AiApiSnippetBlock[];
  hint: string;
}

/** What the guide shows in place of a key it does not have. */
export const AI_API_KEY_PLACEHOLDER = '<your-api-key>';

/**
 * A key as the code blocks show it: the first part and an ellipsis, as the
 * design does. Copy always takes the whole key, so a shortened block is still
 * a working one once pasted.
 */
const shortenKey = (key: string): string =>
  key === AI_API_KEY_PLACEHOLDER || key.length <= 20 ? key : `${key.slice(0, 18)}…`;

const block = (label: string, lines: (key: string) => string, key: string): AiApiSnippetBlock => ({
  label,
  display: lines(shortenKey(key)),
  copy: lines(key),
});

/**
 * The setup for each agent, from the base URL (without `/v1`), a key — the
 * real one on the key-ready screen, a placeholder in the guide — and the model
 * to start with.
 *
 * Anthropic-style clients (Claude Code, OpenClaw's `anthropic-messages`) take
 * the root and add `/v1` themselves; OpenAI-style ones (Codex, everything
 * else) are given the `/v1` base.
 */
export function buildAiApiSetupGuide(params: {
  agent: AiApiAgent;
  baseUrl: string;
  apiKey: string;
  model: string;
}): AiApiSetupGuide {
  const { baseUrl, apiKey, model } = params;
  const v1 = `${baseUrl}/v1`;

  switch (params.agent) {
    case 'claude-code':
      return {
        blocks: [
          block(
            'Terminal',
            key =>
              [
                `export ANTHROPIC_BASE_URL=${baseUrl}`,
                `export ANTHROPIC_AUTH_TOKEN=${key}`,
                `export ANTHROPIC_MODEL=${model}`,
                // Claude Code's background work runs on its own small model;
                // pointing it here keeps every request on this key.
                `export ANTHROPIC_DEFAULT_HAIKU_MODEL=${model}`,
                'claude',
              ].join('\n'),
            apiKey,
          ),
        ],
        hint: 'Run this in the terminal on the computer where Claude Code runs, then use it as usual.',
      };

    case 'codex':
      return {
        blocks: [
          block(
            '~/.codex/config.toml',
            () =>
              [
                `model = "${model}"`,
                'model_provider = "solid"',
                '',
                '[model_providers.solid]',
                'name = "Solid AI API"',
                `base_url = "${v1}"`,
                'env_key = "SOLID_AI_API_KEY"',
                'wire_api = "responses"',
              ].join('\n'),
            apiKey,
          ),
          block('Then run', key => [`export SOLID_AI_API_KEY=${key}`, 'codex'].join('\n'), apiKey),
        ],
        hint: 'Add this to your Codex config, then start Codex from the same terminal.',
      };

    case 'openclaw':
      return {
        blocks: [
          block(
            '~/.openclaw/openclaw.json',
            key =>
              [
                '"solid": {',
                `  "baseUrl": "${v1}",`,
                `  "apiKey": "${key}",`,
                '  "authHeader": true,',
                '  "api": "anthropic-messages"',
                '}',
              ].join('\n'),
            apiKey,
          ),
          block(
            'Then run',
            () => [`openclaw models set "solid/${model}"`, 'openclaw gateway restart'].join('\n'),
            apiKey,
          ),
        ],
        hint: 'Add this under models.providers in your OpenClaw config. Hermes works the same way, in ~/.hermes/config.yaml.',
      };

    default:
      return {
        blocks: [
          block(
            'Terminal',
            key =>
              [
                `curl ${v1}/chat/completions \\`,
                `  -H "Authorization: Bearer ${key}" \\`,
                '  -H "Content-Type: application/json" \\',
                `  -d '{"model":"${model}","messages":[{"role":"user","content":"Hello"}]}'`,
              ].join('\n'),
            apiKey,
          ),
        ],
        hint: `Any agent that speaks the OpenAI or Anthropic API works: use ${v1} as the base URL and your key as the API key.`,
      };
  }
}
