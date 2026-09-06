**Comparison Target**

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-f5ed5805-57b9-43d5-8cb4-7be4e17bc21d.png`, with the requested card-width annotation.
- Before screenshot: `/tmp/solid-wallet-card-before.png`.
- Implementation screenshot: `/tmp/solid-wallet-card-final.png`.
- Full-view comparison: `/tmp/solid-wallet-card-reference-comparison.png`.
- Focused before/after comparison: `/tmp/solid-wallet-card-width-comparison.png`.
- Viewport/state: Pixel 9a Android emulator, wallet home, dark theme, signed-in state.
- Source pixels: 479 × 885, including the supplied emulator frame.
- Before and implementation pixels: 1080 × 2424 at 420 dpi.
- CSS/layout viewport: 392.7 dp wide (1080 px at Android density scale 2.75).
- Density normalization: the exact-viewport before and after captures use the same native density; the supplied framed source is shown beside the implementation at a shared display height in the full-view comparison.

**Findings**

- No actionable P0/P1/P2 differences remain for the requested width change.
- Spacing and layout rhythm: before the change, the visible green card body spanned x=59–1019 px while the balance card below spanned x=42–1037 px. After the change, the green body spans x=41–1037 px, aligning to the balance content edges within one antialiased pixel.
- Fonts and typography: unchanged.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: the original VISA artwork and its aspect ratio remain intact; only its responsive layout width changed.
- Copy and content: unchanged.
- Interaction: tapping the widened card still opens the card-details pane, and the pane's back control returns to the wallet with the widened card restored.

**Full-view evidence**

- The supplied reference and final Android capture are combined in `/tmp/solid-wallet-card-reference-comparison.png`.
- The final capture shows the visible green card body sharing the same horizontal content boundaries as the balance row below.

**Focused region comparison evidence**

- `/tmp/solid-wallet-card-width-comparison.png` compares the same 1080 px viewport and card/balance region before and after.
- The comparison shows the card widening symmetrically while its artwork, badge, logo, and surrounding layout retain their proportions.

**Comparison History**

- Initial finding: the artwork's baked-in shadow gutters made its visible body 35 px narrower than the px-4 balance content on each side.
- Fix: calculate a centered responsive artwork width from the card body's 88.85% share of the image box and the screen's 16 dp content gutter.
- Post-fix evidence: the green body and balance content now terminate at x≈42 and x=1038, and the card-details open/close transition remains functional.

**Validation**

- Prettier: passed for `components/Home/NewHome/HomeWalletCard.tsx`.
- ESLint: passed for `components/Home/NewHome/HomeWalletCard.tsx`.
- TypeScript: the repository-wide check remains blocked by pre-existing errors in unrelated files; no error references the changed component.
- Runtime log: no fatal Android or React Native exception occurred during the card open/close test. Existing 401 price-fallback logs are unrelated to this layout change.

**Implementation Checklist**

- [x] Match the visible card body to the balance content width.
- [x] Keep the card centered and responsive.
- [x] Preserve the original card artwork and aspect ratio.
- [x] Verify card-details open and return interactions.
- [x] Run targeted formatting and lint validation.

**Follow-up Polish**

- None required for this scoped change.

final result: passed

# Vault Breakdown Unselected Segment Color

**Comparison Target**

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-c6ca17de-3ad3-4eb9-b51d-422dce322271.png` for the established breakdown layout, plus the user's explicit `#43643C` token for all unselected chart segments.
- Implementation screenshot: `/tmp/solid-vault-breakdown-unselected-43643c-focused-page.png`.
- Focused implementation crop: `/tmp/solid-vault-breakdown-unselected-43643c-card.png`.
- Side-by-side comparison: `/tmp/solid-vault-breakdown-unselected-43643c-comparison.png`.
- Browser viewport: 1905 × 1249 CSS px at device-pixel ratio 1.
- Source pixels: 469 × 721; source card crop: 379 × 626.
- Implementation pixels: 1905 × 1249; implementation card crop: 386 × 624.
- Density normalization: source card crop was scaled to 386 × 624 before the focused comparison.
- State: collapsed breakdown, first position selected; a second-position selection and expanded-list state were also tested interactively.

**Findings**

- No actionable P0/P1/P2 differences remain for the requested segment-color change.
- Fonts and typography: unchanged from the previously approved breakdown treatment.
- Spacing and layout rhythm: chart geometry, segment gaps, stroke widths, row spacing, and card dimensions remain unchanged.
- Colors and visual tokens: browser inspection confirms seven unselected SVG segments use exactly `#43643C`; the selected segment remains exactly `#90EA7B` with the emphasized stroke width.
- Image quality and asset fidelity: the existing SVG chart and protocol assets remain sharp and unchanged; no substitute assets were introduced.
- Copy and content: allocation, APY, position names, and the expansion control remain unchanged.
- Interaction: selecting another row moves the `#90EA7B` highlight while all other segments remain `#43643C`; expanding the list still changes the control to `Show less`.

**Full-view Evidence**

- `/tmp/solid-vault-breakdown-unselected-43643c-focused-page.png` shows the updated chart in the live savings page without layout overflow or visual regression.

**Focused Region Comparison Evidence**

- `/tmp/solid-vault-breakdown-unselected-43643c-comparison.png` places the supplied breakdown reference and the updated implementation together at the same card size. The darker unselected ring is the intentional, user-specified token change; the surrounding layout remains aligned.

**Comparison History**

- Earlier state: unselected segments used `#5D9152`.
- Fix: change the shared unselected-segment token to `#43643C`.
- Post-fix evidence: live SVG inspection returned seven `#43643C` strokes and one `#90EA7B` selected stroke before and after row selection. No P0/P1/P2 issue remains.

**Validation**

- Prettier and ESLint: passed for `components/Savings/NewSavings/VaultStrategyBreakdownCard.tsx`.
- Browser interaction: row selection and breakdown expansion passed.
- Browser runtime: no component-specific warning or error was emitted; the existing unauthenticated fetch toast remains unrelated.

**Implementation Checklist**

- [x] Change every unselected chart segment to `#43643C`.
- [x] Preserve selected segment color `#90EA7B`.
- [x] Preserve selection and expansion behavior.
- [x] Verify the rendered SVG colors in the browser.

**Follow-up Polish**

- None required for this scoped color update.

final result: passed

---

# Interactive Vault Breakdown

**Comparison Target**

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-96a156ac-ee82-49c0-a4ae-7a427b3bbc7c.png`.
- Browser-rendered implementation: `/tmp/solid-vault-breakdown-viewport-final.png`.
- Focused implementation crop: `/tmp/solid-vault-breakdown-card-final.png`.
- Focused side-by-side comparison: `/tmp/solid-vault-breakdown-comparison-final.png`.
- Expanded-state evidence: `/tmp/solid-vault-breakdown-expanded.png`.
- Viewport/state: 430 × 932 CSS px mobile-web viewport, dark theme, first strategy selected, four-row collapsed state.
- Source pixels: 511 × 1107; focused source crop: 477 × 760.
- Implementation pixels: 430 × 932 at 1× density; rendered card: 383 × 625 CSS px.
- Density normalization: the 477 px-wide source crop was scaled to 383 px wide and vertically padded to 625 px beside the unscaled 383 × 625 implementation crop.

**Findings**

- No actionable P0/P1/P2 differences remain for the requested interaction and information hierarchy.
- Fonts and typography: Mona Sans preserves the product's current typography while matching the reference hierarchy for the allocation label, large percentage, strategy title, APY detail, column headers, two-line strategy names, and numeric columns. Live strategy names and values differ from the reference by design.
- Spacing and layout rhythm: the selected-row background, left color rail, aligned allocation/APY columns, right-side protocol icon, four-row preview, and centered expansion control follow the reference. The donut remains at the existing card's 189 px size so this scoped change stays consistent with the current savings screen.
- Colors and visual tokens: the reference behavior is translated into the current vault's green palette. The selected segment and matching row rail use a pale highlight while unselected segments recede; the button keeps the existing pale-purple action token.
- Image quality and asset fidelity: the implementation uses the product's real protocol images and the existing vector donut renderer. No placeholder, emoji, or recreated logo asset was introduced.
- Copy and content: the center now shows `Allocation`, selected allocation, strategy name, and estimated APY; the table shows `Position`, `Allocation`, `Est. APY`, and `Protocol`; the collapsed control reads `View full breakdown` and the expanded control reads `Show less`.
- Interaction: selecting a row updates the bright donut segment and all center content. Expanding grows the card from 625 px to 945 px and reveals all nine live strategies without a nested scrollbar; collapsing returns it to 625 px. If a hidden strategy was selected, collapsing safely resets selection to the first visible row.

**Full-view Evidence**

- `/tmp/solid-vault-breakdown-viewport-final.png` shows the collapsed card in the live savings page at the target mobile width without horizontal overflow or header wrapping.
- `/tmp/solid-vault-breakdown-expanded.png` shows the revealed strategy rows and working `Show less` control in the normal page scroll.

**Focused Region Comparison Evidence**

- `/tmp/solid-vault-breakdown-comparison-final.png` places the source and implementation together at a common width. A focused comparison was required because the requested changes concern selected-segment treatment, chart-center content, row markers, selection background, columns, and collapsed-list control.

**Comparison History**

- Initial finding: the first mobile pass allowed the narrow `Protocol` header to wrap, and the position column truncated a medium-length first strategy name.
- Fix: rebalance the fixed numeric/icon columns, reduce the strategy title by one pixel, and use an optically smaller one-line protocol header.
- Post-fix evidence: `/tmp/solid-vault-breakdown-comparison-final.png` shows all headers on one line and the first two medium-length strategy names in full. No P0/P1/P2 visual issue remains.

**Validation**

- Prettier and ESLint: passed for `components/Savings/NewSavings/VaultStrategyBreakdownCard.tsx`.
- TypeScript: the repository-wide check remains blocked by existing errors in unrelated files; no error references the breakdown component.
- Browser interaction: default selection, second-row selection, expansion, hidden-row selection, collapse, and hidden-selection reset all passed.
- Browser runtime: no breakdown, SVG, invalid-number, or transform-origin warning was emitted on the clean final load. Existing unauthenticated API fetch errors and unrelated application warnings remain visible in local development.

**Implementation Checklist**

- [x] Highlight one donut segment and one row by default.
- [x] Update the highlighted segment and center details when a row is pressed.
- [x] Add a color rail to the left of every strategy row.
- [x] Remove the nested scrolling list.
- [x] Add a four-row `View full breakdown` preview and working collapse control.
- [x] Preserve the current product palette, protocol imagery, responsive width, and outer page scroll.

**Follow-up Polish**

- None required for this scoped interaction change.

final result: passed

---

# APY History Bars

**Comparison Target**

- Source visual truth: `/tmp/solid-apy-card.esBLoa/card.png` (Figma node 24766:4859).
- Current-state reference supplied by the user: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-3676f597-5cc9-4532-9ab8-fa64d59afbbe.png`.
- Implementation screenshot: `/tmp/solid-apy-bars-card-final.png`.
- Full-view implementation evidence: `/tmp/solid-apy-bars-default.jpg`.
- Focused side-by-side comparison: `/tmp/solid-apy-bars-comparison-final.png`.
- Viewport/state: 1280 × 720 desktop-web viewport, dark theme, default loaded 7D state; the card itself measured 387 × 199 CSS px.
- Source pixels: 385 × 199 at 1× density.
- Implementation crop: 386 × 198 after the browser JPEG crop rounded each dimension to an even pixel; the rendered component measured 387 × 199 CSS px at 1× density.
- Density normalization: source and implementation were scaled to 386 × 198 before the focused side-by-side comparison.

**Findings**

- No actionable P0/P1/P2 differences remain for the requested chart-type change.
- Fonts and typography: Mona Sans hierarchy, weights, line heights, and title/value alignment match the source; the percentage differs because it is live vault data.
- Spacing and layout rhythm: the 199 px card height, 20 px header inset, rounded 20 px corners, selector position, and 76 px chart slot match the source. The first implementation pass left library headroom above the bars and narrower horizontal coverage; both were corrected.
- Colors and visual tokens: the card remains `#1C1C1C`; bars use the source's `#94F27F` top color fading to 15% opacity at the bottom.
- Image quality and asset fidelity: no raster asset was substituted. The bars remain sharp at 1× and use rounded vector geometry on web and native.
- Copy and content: title, APY value, tooltip, and period selector remain unchanged.
- Interaction: 7D → 15D → 7D selection was tested; the headline, percentage, and historical data update together.

**Full-view Evidence**

- `/tmp/solid-apy-bars-default.jpg` shows the APY card between the savings simulator and strategy breakdown without overlap or responsive drift.

**Focused Region Comparison Evidence**

- `/tmp/solid-apy-bars-comparison-final.png` places the Figma source and implementation at the same normalized size. A focused comparison was required because the bar height, density, gradient, and edge insets are the requested visual change.

**Comparison History**

- Initial finding: the compact bar chart inherited automatic numeric-scale headroom and four-pixel vertical margins, so the bars were visibly shorter than the source; its first/last bars also sat too far inward.
- Fix: pin the compact Y domain to `0...dataMax`, remove compact vertical margins, widen the chart slot by five pixels per side, and resample the history to 24 evenly spaced bars.
- Post-fix evidence: `/tmp/solid-apy-bars-comparison-final.png` shows the bars filling the intended 76 px slot with the source's density and fade. No P0/P1/P2 mismatch remains; the approximately two-pixel horizontal antialiasing difference is P3 and acceptable.

**Validation**

- Prettier and ESLint: passed for the three changed APY/bar-chart files.
- Focused Jest coverage: 2 suites, 6 tests passed.
- TypeScript: the repository-wide check remains blocked by existing errors in unrelated files; no error references the changed APY or bar-chart components.
- Browser runtime: no `BarChart` or invalid-number warnings were emitted. Existing unrelated API fetch failures remain visible in local development.

**Implementation Checklist**

- [x] Replace the compact line with vertical bars.
- [x] Preserve live historical APY data and the 7D/15D/30D selector.
- [x] Match the Figma bar density, height, rounded caps, and green fade.
- [x] Support both web and native rendering.
- [x] Verify the loaded default state and period interaction.

**Follow-up Polish**

- P3: the browser-rendered first bar begins approximately two pixels left of the normalized Figma source; no action is required unless pixel-perfect chart-edge alignment is desired.

final result: passed

---

# Vault Breakdown Label and Color Cleanup

**Comparison Target**

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-b31ed5ac-8c38-4743-bea8-6987bd60d94f.png`.
- Browser-rendered implementation: `/tmp/solid-vault-breakdown-tap-selected-final.png`.
- Focused implementation crop: `/tmp/solid-vault-breakdown-tap-selected-card-final.png`.
- Focused side-by-side comparison: `/tmp/solid-vault-breakdown-cleanup-comparison-final.png`.
- Viewport/state: 430 × 932 CSS px mobile-web viewport, dark theme, second strategy selected after a pointer tap, four-row collapsed state.
- Source pixels: 470 × 699; focused source crop: 387 × 625.
- Implementation pixels: 430 × 932 at 1× density; rendered card: 383 × 625 CSS px.
- Density normalization: the 387 px-wide source card was scaled to 383 px wide and vertically padded beside the unscaled 383 × 625 implementation card.

**Findings**

- No actionable P0/P1/P2 differences remain for the requested cleanup.
- Fonts and typography: the small strategy-type labels have been removed completely. Strategy titles retain the existing Mona Sans weight, size, single-line truncation behavior, and vertical centering.
- Spacing and layout rhythm: every left-side color rail has been removed, and the position header and titles now share the row's seven-pixel inset. Row height, numeric-column alignment, protocol icons, selected background, and card height remain stable.
- Colors and visual tokens: the selected positive-allocation segment renders as exactly `#90EA7B`; all other positive-allocation segments render as exactly `#5D9152`, at full opacity. Browser DOM inspection confirmed one selected stroke and seven unselected strokes for the live data.
- Image quality and asset fidelity: the existing protocol images remain unchanged and sharp. No new or substituted assets were introduced.
- Copy and content: the circled strategy-type subtitles from the reference are absent. Position titles, allocation values, APY values, protocol icons, center content, and expansion copy are preserved.
- Interaction: tapping the second row still updates the selected segment and center allocation to 15.00%; `View full breakdown` still expands to `Show less` and collapses normally.

**Full-view Evidence**

- `/tmp/solid-vault-breakdown-tap-selected-final.png` shows the updated card in the live savings page at the target mobile width, with no horizontal overflow.

**Focused Region Comparison Evidence**

- `/tmp/solid-vault-breakdown-cleanup-comparison-final.png` places the annotated source and final implementation together at the same effective card width. The annotations identify the labels and rails to remove; they are evidence, not UI elements to reproduce.

**Comparison History**

- Earlier state: strategy rows displayed a small protocol/type subtitle and a colored vertical rail; the selected segment used pale `#E4FFDE`, while unselected segments used multiple green shades with reduced opacity.
- Fix: remove the subtitle and rail elements, realign the header and row content, and replace the segment palette with exact selected/unselected constants at full opacity.
- Post-fix evidence: `/tmp/solid-vault-breakdown-cleanup-comparison-final.png` shows no subtitles or rails, while DOM inspection confirms exact `#90EA7B` and `#5D9152` strokes. No P0/P1/P2 issue remains.

**Validation**

- Prettier and ESLint: passed for `components/Savings/NewSavings/VaultStrategyBreakdownCard.tsx`.
- Browser interaction: second-row selection, center-content update, expand, and collapse passed.
- Browser runtime: no breakdown, SVG, invalid-number, stroke, or transform-origin warning was emitted. Existing unauthenticated API fetch errors remain unrelated to this component.

**Implementation Checklist**

- [x] Remove all strategy-type labels.
- [x] Remove all left-side vertical rails.
- [x] Set the selected segment to `#90EA7B`.
- [x] Set every unselected segment to `#5D9152`.
- [x] Preserve row selection and full-breakdown expansion.

**Follow-up Polish**

- None required for this scoped cleanup.

final result: passed

---

# Vault Breakdown Expansion Control

**Comparison Target**

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-c6ca17de-3ad3-4eb9-b51d-422dce322271.png`.
- Browser-rendered collapsed state: `/tmp/solid-vault-breakdown-control-collapsed-mobile-final.png`.
- Browser-rendered expanded state: `/tmp/solid-vault-breakdown-control-expanded-mobile-final.png`.
- Focused implementation crop: `/tmp/solid-vault-breakdown-control-card-final.png`.
- Focused side-by-side comparison: `/tmp/solid-vault-breakdown-control-comparison-final.png`.
- Viewport/state: 430 × 932 CSS px mobile-web viewport, dark theme, first strategy selected; collapsed and expanded controls both tested.
- Source pixels: 469 × 721; focused source crop: 381 × 625.
- Implementation pixels: 430 × 932 at 1× density; rendered card: 383 × 625 CSS px while collapsed.
- Density normalization: source and implementation card crops were normalized to 383 × 625 before the side-by-side comparison.

**Findings**

- No actionable P0/P1/P2 differences remain for the requested control styling.
- Fonts and typography: the existing 15 px medium Mona Sans label, line height, case, and centering are preserved.
- Spacing and layout rhythm: a 16 px icon and six-pixel gap were added without changing the control height, card height, or surrounding spacing. The icon and label remain optically centered.
- Colors and visual tokens: browser-computed text color and the icon's SVG stroke are both exactly `rgba(255, 255, 255, 0.7)` in collapsed and expanded states.
- Image quality and asset fidelity: plus and minus use the project's existing Lucide-backed icon components; no text glyphs or substitute image assets were introduced.
- Copy and content: collapsed state shows a plus with `View full breakdown`; expanded state shows a minus with `Show less`.
- Interaction: pointer activation switches from plus to minus, expands the full list, and switches back on collapse.

**Full-view Evidence**

- `/tmp/solid-vault-breakdown-control-collapsed-mobile-final.png` shows the updated plus control in the live savings page without overflow.
- `/tmp/solid-vault-breakdown-control-expanded-mobile-final.png` shows the minus control beneath the complete expanded list.

**Focused Region Comparison Evidence**

- `/tmp/solid-vault-breakdown-control-comparison-final.png` places the annotated source and final collapsed implementation together at the same card size, showing the requested white/70% treatment and added plus icon.

**Comparison History**

- Earlier state: the expansion link used the pale-purple token and had no state icon.
- Fix: replace the label color with white at 70% opacity and render the existing plus/minus icon components according to expansion state.
- Post-fix evidence: `/tmp/solid-vault-breakdown-control-comparison-final.png` and browser-computed styles confirm the final color and alignment; expanded-state evidence confirms the minus icon. No P0/P1/P2 issue remains.

**Validation**

- Prettier and ESLint: passed for `components/Savings/NewSavings/VaultStrategyBreakdownCard.tsx`.
- Browser interaction: collapsed plus state and expanded minus state passed.
- Browser runtime: no component-specific warning or error was emitted. Existing unauthenticated API fetch errors remain unrelated.

**Implementation Checklist**

- [x] Change link and icon to white at 70% opacity.
- [x] Show plus while collapsed.
- [x] Show minus while expanded.
- [x] Preserve expansion behavior and layout.

**Follow-up Polish**

- None required for this scoped control update.

final result: passed

# Vault Breakdown Column Header Alignment

**Comparison Target**

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-3af76cc0-bfcb-49c2-b607-8c716359bee1.png`.
- Browser-rendered implementation: `/tmp/solid-vault-breakdown-columns-aligned-selected-third-page.png`.
- Focused implementation crop: `/tmp/solid-vault-breakdown-columns-aligned-card.png`.
- Side-by-side comparison: `/tmp/solid-vault-breakdown-columns-aligned-comparison.png`.
- Browser viewport: 1905 × 1249 CSS px at device-pixel ratio 1.
- Source pixels: 440 × 707; source card crop: 379 × 626.
- Implementation pixels: 1905 × 1249; implementation card crop: 386 × 624.
- Density normalization: the source card crop was scaled to 386 × 624 for the focused comparison.
- State: collapsed breakdown with `InfiniFi liUSD-1w` selected, matching the supplied reference state.

**Findings**

- No actionable P0/P1/P2 differences remain for column alignment.
- Fonts and typography: the existing header and row font families, sizes, weights, line heights, and opacity are unchanged.
- Spacing and layout rhythm: each header now uses the exact same four-column geometry as every strategy row: 169 px flexible position column, then fixed 66 px, 54 px, and 44 px columns. Browser measurements confirm identical x positions, centers, widths, and right edges in the header and selected row.
- Colors and visual tokens: selected and unselected chart colors, row background, text colors, and link opacity remain unchanged.
- Image quality and asset fidelity: protocol icons and the SVG chart remain unchanged and sharp.
- Copy and content: all four titles and all row values remain unchanged.
- Interaction: changing the selected row preserves the same column geometry and moves the chart highlight correctly.

**Full-view Evidence**

- `/tmp/solid-vault-breakdown-columns-aligned-selected-third-page.png` shows the corrected header in the live savings page without overflow or surrounding layout regression.

**Focused Region Comparison Evidence**

- `/tmp/solid-vault-breakdown-columns-aligned-comparison.png` places the supplied reference and corrected implementation together at the same card size. The implementation's Allocation, Est. APY, and Protocol headers sit directly on the same column tracks as their values and icons.

**Comparison History**

- Earlier P2 finding: the header used seven pixels of leading padding but no trailing padding, making its flexible Position track seven pixels wider and shifting the remaining titles seven pixels to the right of the data columns.
- Fix: change the header container from `pl-[7px]` to symmetric `px-[7px]`, matching the row containers.
- Post-fix evidence: live measurements show header and row column starts at 937.5, 1106.5, 1172.5, and 1226.5 CSS px, with matching centers and widths. No P0/P1/P2 issue remains.

**Validation**

- Prettier and ESLint: passed for `components/Savings/NewSavings/VaultStrategyBreakdownCard.tsx`.
- Browser interaction: switching from the first row to the third row passed with unchanged column measurements.
- Browser runtime: no component-specific warning or error was emitted; the existing unauthenticated fetch toast remains unrelated.

**Implementation Checklist**

- [x] Match header horizontal padding to row horizontal padding.
- [x] Verify all four header and row column tracks numerically.
- [x] Verify alignment with a different selected row.
- [x] Preserve chart colors, icons, copy, and expansion control.

**Follow-up Polish**

- None required for this scoped alignment fix.

final result: passed

---

# Rewards summary interaction QA

## Evidence

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-47cc6d5a-1c6e-4a95-9ab0-57e409d6d7de.png`
- Closed implementation: `/Users/elismargon/Developer/solid/solid-ui/artifacts/design-qa/rewards-summary-mobile.png`
- Cashback open: `/Users/elismargon/Developer/solid/solid-ui/artifacts/design-qa/rewards-cashback-open.png`
- Referrals open: `/Users/elismargon/Developer/solid/solid-ui/artifacts/design-qa/rewards-referrals-open.png`
- Full-view comparison: `/Users/elismargon/Developer/solid/solid-ui/artifacts/design-qa/rewards-summary-comparison.png`
- Focused card comparison: `/Users/elismargon/Developer/solid/solid-ui/artifacts/design-qa/rewards-summary-card-comparison.png`
- Source pixels: 850 x 1104, including the device frame and a partial screen crop.
- Implementation pixels and CSS viewport: 393 x 852 at device scale factor 1.
- Density normalization: the full-view comparison scales both captures to 900 px high. The focused comparison crops the Rewards card from both captures, scales both to 700 px wide, and pads the shorter crop for an equal-height side-by-side review.
- State: mobile dark-mode Rewards screen, summary closed for visual comparison; each summary action opened separately for interaction verification.

## Findings

- No actionable P0, P1, or P2 mismatch was introduced. The Cashback and Referrals columns keep the existing card layout while gaining full-column tap targets.
- Fonts and typography: the existing Mona Sans family, weights, sizes, line heights, hierarchy, wrapping, and labels are unchanged by the interaction wrappers.
- Spacing and layout rhythm: the header, divider, equal-width columns, internal alignment, card radius, and vertical rhythm remain intact. The Pressable roots occupy the same flex layout as the previous View roots.
- Colors and visual tokens: the existing card background, white opacity levels, divider, green Rewards icon, and active-state opacity are preserved.
- Image quality and asset fidelity: no image or icon assets changed. The existing vector Rewards icon remains sharp and unchanged.
- Copy and content: `Cashback`, `Referrals`, the amounts, and the optional pending line remain unchanged.
- Accessibility and affordance: both columns are exposed as buttons with value-aware labels. The Cashback column opens the existing cashback details sheet; the Referrals column opens the existing referral program drawer.
- The reference shows a Prime account and an available Spin action, while the local preview rendered Core fallback data and no Spin action because the local rewards requests could not reach their services. These are pre-existing data/runtime differences outside this interaction change.

## Primary interactions tested

- Tapped `Cashback. $0.00`: the Cashback details bottom sheet opened and displayed the rate, monthly earnings, cap, all-time cashback, and action button.
- Closed the Cashback sheet, then tapped `Referrals. $0.00`: the referral drawer opened and displayed the referral offer, qualification steps, sharing actions, and invited-friends section.
- Checked browser console errors: only pre-existing local API `Failed to fetch` errors appeared; no render, press-handler, or modal-opening error was introduced by this change.

## Comparison history

- Pass 1: the closed-state full view and focused Rewards-card comparison showed no P0/P1/P2 regression, so no visual correction iteration was required.

## Implementation checklist

- [x] Entire Cashback summary half is tappable.
- [x] Cashback tap opens the existing cashback details sheet.
- [x] Entire Referrals summary half is tappable.
- [x] Referrals tap opens the existing referral drawer.
- [x] Existing visual layout and assets are preserved.
- [x] Both controls expose accessible button labels.

## Follow-up polish

- None required for this scoped interaction change.

final result: passed
