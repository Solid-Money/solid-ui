import { useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import {
  DEPOSIT_PARAM,
  HOME_LINK_PARAMS,
  HomeLinkParam,
  parseHomeLinkAction,
  SPEND_MODE_PARAM,
  WHATS_NEW_PARAM,
  WHATS_NEW_STEP_PARAM,
} from '@/constants/homeLinkParams';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useOpenDepositFlow } from '@/hooks/useOpenDepositFlow';
import { useCardPaneStore } from '@/store/useCardPaneStore';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

const CLEARED_PARAMS = Object.fromEntries(HOME_LINK_PARAMS.map(param => [param, undefined]));

interface HomeLinkActionContext {
  /** Card status has loaded, so whether the user has a card is known. */
  isCardKnown: boolean;
  hasCard: boolean;
  /** Spend-mode figures have loaded, so `canChangeMode` is the real answer. */
  isSpendModeKnown: boolean;
  canChangeMode: boolean;
}

/**
 * Acts on the one-shot Home params a link carried (`constants/homeLinkParams`)
 * and then clears them.
 *
 * Cleared for the same reason `?screen=card-info` is: the instruction is for
 * the tap that arrived with it. Left in the URL it would re-open the sheet
 * every time Home remounts, including right after the user closed it.
 *
 * The spend-mode selector waits for card status and the mode figures, because
 * what it should do depends on them: a cardholder who can switch modes gets the
 * selector, one who cannot gets the card pane (the closest thing to what the
 * link was about), and someone without a card stays on Home. Opening the
 * selector before that is known would flash a sheet that may not apply.
 */
export function useHomeLinkAction({
  isCardKnown,
  hasCard,
  isSpendModeKnown,
  canChangeMode,
}: HomeLinkActionContext) {
  const params = useLocalSearchParams<Partial<Record<HomeLinkParam, string>>>();
  const whatsNew = params[WHATS_NEW_PARAM];
  const whatsNewStep = params[WHATS_NEW_STEP_PARAM];
  const deposit = params[DEPOSIT_PARAM];
  const spendMode = params[SPEND_MODE_PARAM];

  const openDepositFlow = useOpenDepositFlow();
  const requestWhatsNew = useWhatsNewStore(state => state.requestWhatsNew);
  const openSpendMode = useCardPaneStore(state => state.openSpendMode);
  const openCardPane = useCardPaneStore(state => state.open);
  // The params of the link already acted on. Clearing them is asynchronous, so
  // the effect can run again (a dependency settling) before they are gone; this
  // keeps one link to one sheet and one deposit-trigger event.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const values: Partial<Record<HomeLinkParam, string>> = {
      [WHATS_NEW_PARAM]: whatsNew,
      [WHATS_NEW_STEP_PARAM]: whatsNewStep,
      [DEPOSIT_PARAM]: deposit,
      [SPEND_MODE_PARAM]: spendMode,
    };
    const action = parseHomeLinkAction(param => values[param]);
    if (!action) {
      handledRef.current = null;
      return;
    }
    const key = JSON.stringify(values);
    if (handledRef.current === key) return;

    switch (action.kind) {
      case 'whats-new':
        requestWhatsNew(action.id, action.step);
        break;
      case 'deposit':
        openDepositFlow({
          modal:
            action.target === 'cash'
              ? DEPOSIT_MODAL.OPEN_DEPOSIT_CASH
              : DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE,
          source: 'deep_link',
        });
        break;
      case 'spend-mode':
        if (!isCardKnown || (hasCard && !isSpendModeKnown)) return;
        if (hasCard && canChangeMode) {
          openSpendMode();
        } else if (hasCard) {
          openCardPane();
        }
        break;
    }

    handledRef.current = key;
    router.setParams(CLEARED_PARAMS);
  }, [
    whatsNew,
    whatsNewStep,
    deposit,
    spendMode,
    isCardKnown,
    hasCard,
    isSpendModeKnown,
    canChangeMode,
    requestWhatsNew,
    openDepositFlow,
    openSpendMode,
    openCardPane,
  ]);
}
