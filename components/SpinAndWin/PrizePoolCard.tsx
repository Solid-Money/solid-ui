import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

import { Text } from '@/components/ui/text';
import { SPIN_WIN } from '@/constants/spinWinDesign';
import { GiveawayStatus, GiveawayWinner } from '@/lib/types/spin-win';

interface PrizePoolCardProps {
  prizePool: number;
  countdown: string;
  qualifiedCount: number;
  status: GiveawayStatus;
  winners?: GiveawayWinner[];
}

export default function PrizePoolCard({
  prizePool,
  countdown,
  qualifiedCount: _qualifiedCount,
  status,
  winners,
}: PrizePoolCardProps) {
  const formattedPrize = `$${prizePool.toLocaleString()}`;
  const isDrawing = status === 'drawing';
  const isCompleted = status === 'completed';

  return (
    <LinearGradient
      colors={[SPIN_WIN.gradient.prizePoolColors[0], SPIN_WIN.gradient.prizePoolColors[1]]}
      start={SPIN_WIN.gradient.prizePoolStart}
      end={SPIN_WIN.gradient.prizePoolEnd}
      style={{
        borderRadius: SPIN_WIN.borderRadius.card,
        padding: 20,
      }}
    >
      {/* Prize pool label */}
      <Text
        style={{
          fontSize: SPIN_WIN.typography.headingSize,
          fontWeight: SPIN_WIN.typography.headingWeight,
          color: SPIN_WIN.colors.goldTransparent,
          marginBottom: 4,
          textAlign: 'center',
        }}
      >
        This week&apos;s prize pool
      </Text>

      {/* Prize amount */}
      <Text
        style={{
          fontSize: SPIN_WIN.typography.largePrize,
          fontWeight: '600',
          color: SPIN_WIN.colors.gold,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        }}
      >
        {formattedPrize}
      </Text>

      {/* Countdown section */}
      {!isCompleted && (
        <>
          <Text
            style={{
              fontSize: SPIN_WIN.typography.bodySize,
              fontWeight: '500',
              color: SPIN_WIN.colors.goldTransparent,
              marginBottom: 4,
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            {isDrawing ? 'Drawing now...' : 'Next Giveaway'}
          </Text>

          {!isDrawing && (
            <Text
              style={{
                fontSize: SPIN_WIN.typography.countdownNumber,
                fontWeight: '600',
                color: SPIN_WIN.colors.gold,
                fontVariant: ['tabular-nums'],
                textAlign: 'center',
              }}
            >
              {countdown}
            </Text>
          )}
        </>
      )}

      {isCompleted && (
        <Text
          style={{
            fontSize: SPIN_WIN.typography.bodySize,
            fontWeight: '500',
            color: SPIN_WIN.colors.goldTransparent,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          Giveaway completed
        </Text>
      )}

      {/* Last Week's Winners */}
      {winners && winners.length > 0 && (
        <>
          <View
            style={{
              height: 1,
              backgroundColor: SPIN_WIN.colors.divider,
              marginVertical: 16,
              marginHorizontal: -20,
            }}
          />

          <Text
            style={{
              fontSize: SPIN_WIN.typography.headingSize,
              fontWeight: SPIN_WIN.typography.headingWeight,
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: 12,
            }}
          >
            Last Week&apos;s Winners
          </Text>

          <View style={{ gap: 16 }}>
            {winners.slice(0, 5).map((winner, i) => (
              <View
                key={`${winner.weekId}-${i}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,209,81,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: SPIN_WIN.colors.gold,
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flexDirection: 'column', marginLeft: 12, flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: SPIN_WIN.colors.textPrimary,
                    }}
                  >
                    {winner.winnerDisplayName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '400',
                      color: SPIN_WIN.colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {format(new Date(winner.giveawayDate), 'MMM d, h:mma')}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: SPIN_WIN.colors.gold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {winner.prizePool.toLocaleString()}$
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </LinearGradient>
  );
}
