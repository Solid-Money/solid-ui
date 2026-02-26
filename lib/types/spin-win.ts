export type GiveawayStatus = 'active' | 'drawing' | 'completed';

export interface SpinStatus {
  currentStreak: number;
  lastSpinDate: string | null;
  totalPointsEarned: number;
  weeklyPointsEarned: number;
  isQualified: boolean;
  spinAvailableToday: boolean;
  isEligible: boolean;
  currentWeekId: string | null;
  isAllowed: boolean;
}

export interface SpinResult {
  pointsEarned: number;
  currentStreak: number;
  totalPointsEarned: number;
  weeklyPointsEarned: number;
  isQualified: boolean;
}

export interface SpinWinGiveaway {
  weekId: string;
  prizePool: number;
  giveawayDate: string;
  status: GiveawayStatus;
  winnerId: string | null;
  winnerDisplayName: string | null;
  qualifiedCount: number;
}

export interface GiveawayWinner {
  weekId: string;
  winnerId: string;
  winnerDisplayName: string;
  prizePool: number;
  giveawayDate: string;
}
