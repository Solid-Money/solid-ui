import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot } from 'lucide-react-native';

import { type AssetPath, getAsset } from '@/lib/assets';

import { AI_API_BRAND } from './AiApiPrimitives';

export type AiApiAgentLogoId = 'claude-code' | 'codex' | 'openclaw' | 'hermes' | 'opencode' | 'own';

export interface AiApiAgentLogoSpec {
  id: AiApiAgentLogoId;
  label: string;
  /** The logo tile's fill, top to bottom. */
  colors: readonly [string, string, ...string[]];
  /** The agent's mark at the 32pt tile; without one, the tile shows a bot for the user's own agent. */
  mark?: { asset: AssetPath; size: number };
}

/** The tile size every mark size below is drawn for. Smaller tiles scale the mark with them. */
const BASE_SIZE = 32;

/** The agents a key works with, in the order the intro lists them. */
export const AI_API_AGENT_LOGOS: AiApiAgentLogoSpec[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    colors: ['#D97757', '#D97757'],
    mark: { asset: 'images/ai-api/agent-claude-code.svg', size: 19 },
  },
  {
    id: 'codex',
    label: 'Codex',
    colors: ['#B1A7FF', '#7A9DFF', '#3941FF'],
    mark: { asset: 'images/ai-api/agent-codex.svg', size: 18 },
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    colors: ['#FF4D4D', '#991B1B'],
    mark: { asset: 'images/ai-api/agent-openclaw.svg', size: 20 },
  },
  {
    id: 'hermes',
    label: 'Hermes',
    colors: ['#000000', '#000000'],
    mark: { asset: 'images/ai-api/agent-hermes.svg', size: 22 },
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    colors: ['#000000', '#000000'],
    mark: { asset: 'images/ai-api/agent-opencode.svg', size: 16 },
  },
  { id: 'own', label: 'Your own agent', colors: [AI_API_BRAND, AI_API_BRAND] },
];

/**
 * An agent's logo: its colour, a white sheen from the top, a hairline edge, its
 * mark. Figma draws it at 32pt in the intro and smaller in the Rewards card,
 * where the mark and the edge scale with the tile.
 */
const AiApiAgentLogo = ({
  agent,
  size = BASE_SIZE,
}: {
  agent: AiApiAgentLogoSpec;
  size?: number;
}) => {
  const scale = size / BASE_SIZE;
  return (
    <LinearGradient
      colors={agent.colors}
      style={[styles.tile, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0)']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.edge, { borderRadius: size / 2, borderWidth: scale }]} />
      {agent.mark ? (
        <Image
          source={getAsset(agent.mark.asset)}
          style={{ width: agent.mark.size * scale, height: agent.mark.size * scale }}
          contentFit="contain"
        />
      ) : (
        <Bot size={18 * scale} color="#111111" strokeWidth={1.36} />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
});

export default AiApiAgentLogo;
