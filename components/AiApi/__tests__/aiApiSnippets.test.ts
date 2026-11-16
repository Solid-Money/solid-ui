import {
  AI_API_AGENT_TABS,
  AI_API_KEY_PLACEHOLDER,
  buildAiApiSetupGuide,
} from '@/components/AiApi/aiApiSnippets';

const BASE_URL = 'https://api.solid.xyz/accounts/v1/ai';
const KEY = 'sk_solid_ai_0123456789abcdefghijklmnopqrstuvwxyz';
const MODEL = 'kimi-k2.6';
const MODELS = [
  { id: 'kimi-k2.6', name: 'Kimi K2.6' },
  { id: 'glm-5', name: 'GLM 5' },
];

const guideFor = (
  agent: (typeof AI_API_AGENT_TABS)[number]['id'],
  apiKey = KEY,
  models = MODELS,
  model = MODEL,
) => buildAiApiSetupGuide({ agent, baseUrl: BASE_URL, apiKey, model, models });

describe('buildAiApiSetupGuide', () => {
  it('has a guide for every tab', () => {
    for (const tab of AI_API_AGENT_TABS) {
      const guide = guideFor(tab.id);
      expect(guide.blocks.length).toBeGreaterThan(0);
      expect(guide.hint).toBeTruthy();
    }
  });

  it('copies the whole key even where it shows a shortened one', () => {
    for (const tab of AI_API_AGENT_TABS) {
      const guide = guideFor(tab.id);
      const withKey = guide.blocks.filter(block => block.copy.includes(KEY));
      expect(withKey.length).toBeGreaterThan(0);
      for (const block of withKey) {
        expect(block.display).not.toContain(KEY);
        expect(block.display).toContain(KEY.slice(0, 18));
      }
    }
  });

  it('points Claude Code at the root, which adds /v1 itself', () => {
    const [terminal] = guideFor('claude-code').blocks;
    expect(terminal.copy).toContain(`ANTHROPIC_BASE_URL=${BASE_URL}\n`);
    expect(terminal.copy).toContain(`ANTHROPIC_AUTH_TOKEN=${KEY}`);
    expect(terminal.copy).toContain(`ANTHROPIC_MODEL=${MODEL}`);
  });

  it('points OpenAI-style agents at the /v1 base', () => {
    expect(guideFor('codex').blocks[0].copy).toContain(`base_url = "${BASE_URL}/v1"`);
    expect(guideFor('openclaw').blocks[0].copy).toContain(`"baseUrl": "${BASE_URL}/v1"`);
    expect(guideFor('opencode').blocks[0].copy).toContain(`"baseURL": "${BASE_URL}/v1"`);
    expect(guideFor('other').blocks[0].copy).toContain(`${BASE_URL}/v1/chat/completions`);
  });

  it('names the model the agent should start on', () => {
    expect(guideFor('openclaw').blocks[1].copy).toContain(`openclaw models set "solid/${MODEL}"`);
    expect(guideFor('codex').blocks[0].copy).toContain(`model = "${MODEL}"`);
    expect(guideFor('opencode').blocks[0].copy).toContain(`"model": "solid/${MODEL}"`);
  });

  describe('OpenCode', () => {
    it('writes a config file OpenCode can read, with every model under its name', () => {
      const [config, run] = guideFor('opencode').blocks;
      expect(config.label).toBe('~/.config/opencode/opencode.json');
      expect(JSON.parse(config.copy)).toEqual({
        $schema: 'https://opencode.ai/config.json',
        provider: {
          solid: {
            npm: '@ai-sdk/openai-compatible',
            name: 'Solid AI API',
            options: { baseURL: `${BASE_URL}/v1`, apiKey: '{env:SOLID_AI_API_KEY}' },
            models: {
              'kimi-k2.6': { name: 'Kimi K2.6' },
              'glm-5': { name: 'GLM 5' },
            },
          },
        },
        model: `solid/${MODEL}`,
      });
      // Pretty-printed, so it reads as a config file rather than one long line.
      expect(config.copy.split('\n').length).toBeGreaterThan(10);
      expect(run.label).toBe('Then run');
      expect(run.copy).toBe(`export SOLID_AI_API_KEY=${KEY}\nopencode`);
    });

    it('keeps the key out of the file, which can live in a project', () => {
      const [config] = guideFor('opencode').blocks;
      expect(config.copy).not.toContain(KEY);
      expect(config.display).toBe(config.copy);
    });

    it('still lists the model it starts on before the model list has loaded', () => {
      const [config] = guideFor('opencode', KEY, [], '<model>').blocks;
      expect(JSON.parse(config.copy).provider.solid.models).toEqual({
        '<model>': { name: '<model>' },
      });
    });
  });

  it('leaves the placeholder whole, so the guide never looks like a real key', () => {
    const [terminal] = guideFor('claude-code', AI_API_KEY_PLACEHOLDER).blocks;
    expect(terminal.display).toContain(AI_API_KEY_PLACEHOLDER);
    expect(terminal.copy).toContain(AI_API_KEY_PLACEHOLDER);
  });
});
