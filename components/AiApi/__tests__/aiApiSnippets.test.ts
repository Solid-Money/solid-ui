import {
  AI_API_AGENT_TABS,
  AI_API_KEY_PLACEHOLDER,
  buildAiApiSetupGuide,
} from '@/components/AiApi/aiApiSnippets';

const BASE_URL = 'https://api.solid.xyz/accounts/v1/ai';
const KEY = 'sk_solid_ai_0123456789abcdefghijklmnopqrstuvwxyz';
const MODEL = 'kimi-k2.6';

const guideFor = (agent: (typeof AI_API_AGENT_TABS)[number]['id'], apiKey = KEY) =>
  buildAiApiSetupGuide({ agent, baseUrl: BASE_URL, apiKey, model: MODEL });

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
    expect(guideFor('other').blocks[0].copy).toContain(`${BASE_URL}/v1/chat/completions`);
  });

  it('names the model the agent should start on', () => {
    expect(guideFor('openclaw').blocks[1].copy).toContain(`openclaw models set "solid/${MODEL}"`);
    expect(guideFor('codex').blocks[0].copy).toContain(`model = "${MODEL}"`);
  });

  it('leaves the placeholder whole, so the guide never looks like a real key', () => {
    const [terminal] = guideFor('claude-code', AI_API_KEY_PLACEHOLDER).blocks;
    expect(terminal.display).toContain(AI_API_KEY_PLACEHOLDER);
    expect(terminal.copy).toContain(AI_API_KEY_PLACEHOLDER);
  });
});
