# Direct Deposit Modal Bug Fix

## Problem

When clicking a direct deposit activity in the activity feed, the modal was not opening.

### Expected Behavior
- User clicks on a direct deposit transaction in the activity list
- The direct deposit address modal opens showing deposit details

### Actual Behavior
- Clicking the transaction did nothing - no modal appeared

## Root Cause

The Activity page (`app/(protected)/(tabs)/activity/index.tsx`) did not have a `DepositOptionModal` component rendered. 

When clicking a direct deposit transaction, the code in `components/Activity/ActivityTransactions.tsx` correctly:
1. Set the session data via `setDirectDepositSession()`
2. Changed the modal state via `setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS)`

However, there was no modal component in the Activity page's component tree to respond to these state changes. The modal component needs to be mounted to listen to the `useDepositStore` state.

## Solution

Added a `DepositOptionModal` component to the Activity page with no visible trigger. This modal responds to state changes from the deposit store.

### File Changed
**`app/(protected)/(tabs)/activity/index.tsx`**

```typescript
// Added import
import DepositOptionModal from '@/components/DepositOption/DepositOptionModal';

// Added hidden modal at the end of the page component
<DepositOptionModal trigger={null} />
```

The modal with `trigger={null}` will:
- Not render a button (since no trigger is provided)
- Still listen to `useDepositStore` state changes
- Open when `setModal()` is called from anywhere (like clicking activities)
- Display the appropriate content based on the modal state

## How It Works

1. User clicks a direct deposit transaction
2. `ActivityTransactions.tsx` calls `setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_DIRECTLY_ADDRESS)`
3. The hidden `DepositOptionModal` on the Activity page detects the state change
4. Modal opens with the `DepositDirectlyAddress` content
5. User can see their deposit details and address

## Testing

### Manual Testing Steps
1. Navigate to the Activity page
2. Click on a direct deposit transaction (one with `clientTxId` starting with `direct_deposit_`)
3. ✅ Modal should now open showing the direct deposit address screen
4. Verify the modal shows correct network and deposit information
5. Close the modal and verify it closes properly

### Automated Testing
Playwright E2E tests have been configured but require authentication setup to run fully. See `tests/README.md` for details.

## Related Code

- **Activity page**: `app/(protected)/(tabs)/activity/index.tsx`
- **Activity click handler**: `components/Activity/ActivityTransactions.tsx` (lines 133-147)
- **Modal component**: `components/DepositOption/DepositOptionModal.tsx`
- **Deposit store**: `store/useDepositStore.ts`
- **Modal constants**: `constants/modals.ts`

## Additional Notes

This is a common pattern in the app - other pages that need to open the deposit modal also render a `DepositOptionModal`:
- Dashboard: Has `DashboardHeaderButtons` which renders `<DepositOptionModal />`
- Other pages: Render the modal either with a trigger button or hidden

The Activity page was missing this component, which is why the modal couldn't open.

