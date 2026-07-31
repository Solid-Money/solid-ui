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
