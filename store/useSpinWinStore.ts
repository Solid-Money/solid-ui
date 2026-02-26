import { produce } from 'immer';
import { create } from 'zustand';

import { GiveawayStatus, SpinResult, SpinStatus, SpinWinGiveaway } from '@/lib/types/spin-win';

interface SpinWinState {
  // Spin status
  currentStreak: number;
  lastSpinDate: string | null;
  totalPointsEarned: number;
  weeklyPointsEarned: number;
  isQualified: boolean;
  spinAvailableToday: boolean;
  isEligible: boolean;
  currentWeekId: string | null;

  // Giveaway state
  giveaway: {
    weekId: string;
    prizePool: number;
    giveawayDate: string;
    status: GiveawayStatus;
    winnerId: string | null;
    winnerDisplayName: string | null;
    qualifiedCount: number;
    timeRemaining: number;
  };

  // Actions
  setSpinStatus: (data: SpinStatus) => void;
  setSpinResult: (data: SpinResult) => void;
  setGiveaway: (data: SpinWinGiveaway) => void;
  setGiveawayTimeRemaining: (timeRemaining: number) => void;
  reset: () => void;
}

const initialGiveaway: SpinWinState['giveaway'] = {
  weekId: '',
  prizePool: 0,
  giveawayDate: '',
  status: 'active',
  winnerId: null,
  winnerDisplayName: null,
  qualifiedCount: 0,
  timeRemaining: 0,
};

export const useSpinWinStore = create<SpinWinState>()(set => ({
  // Initial spin status
  currentStreak: 0,
  lastSpinDate: null,
  totalPointsEarned: 0,
  weeklyPointsEarned: 0,
  isQualified: false,
  spinAvailableToday: false,
  isEligible: false,
  currentWeekId: null,

  // Initial giveaway state
  giveaway: { ...initialGiveaway },

  setSpinStatus: (data: SpinStatus) => {
    set(
      produce(state => {
        state.currentStreak = data.currentStreak;
        state.lastSpinDate = data.lastSpinDate;
        state.totalPointsEarned = data.totalPointsEarned;
        state.weeklyPointsEarned = data.weeklyPointsEarned;
        state.isQualified = data.isQualified;
        state.spinAvailableToday = data.spinAvailableToday;
        state.isEligible = data.isEligible;
        state.currentWeekId = data.currentWeekId;
      }),
    );
  },

  setSpinResult: (data: SpinResult) => {
    set(
      produce(state => {
        state.currentStreak = data.currentStreak;
        state.totalPointsEarned = data.totalPointsEarned;
        state.weeklyPointsEarned = data.weeklyPointsEarned;
        state.isQualified = data.isQualified;
        // After a spin, mark today as already spun
        state.spinAvailableToday = false;
      }),
    );
  },

  setGiveaway: (data: SpinWinGiveaway) => {
    set(
      produce(state => {
        state.giveaway.weekId = data.weekId;
        state.giveaway.prizePool = data.prizePool;
        state.giveaway.giveawayDate = data.giveawayDate;
        state.giveaway.status = data.status;
        state.giveaway.winnerId = data.winnerId;
        state.giveaway.winnerDisplayName = data.winnerDisplayName;
        state.giveaway.qualifiedCount = data.qualifiedCount;
      }),
    );
  },

  setGiveawayTimeRemaining: (timeRemaining: number) => {
    set(
      produce(state => {
        state.giveaway.timeRemaining = timeRemaining;
      }),
    );
  },

  reset: () => {
    set({
      currentStreak: 0,
      lastSpinDate: null,
      totalPointsEarned: 0,
      weeklyPointsEarned: 0,
      isQualified: false,
      spinAvailableToday: false,
      isEligible: false,
      currentWeekId: null,
      giveaway: { ...initialGiveaway },
    });
  },
}));
