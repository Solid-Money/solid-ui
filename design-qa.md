**Comparison Target**

- Source visual truth: `/var/folders/kq/f7j7tsp96mjgyhrd2x1xmd3c0000gn/T/codex-clipboard-c50b2cce-d4de-46ec-9a03-c2928cd570d8.png`
- Top-state screenshot: `/tmp/solid-ui-scroll-pill-top-v4.png`
- Scrolled-state screenshot: `/tmp/solid-ui-fresh-scrolled.png`
- Viewport/state: Android wallet home, dark theme, signed-in state, before and after vertical scrolling
- Source pixels: 403 × 864, including the supplied device frame
- Implementation pixels: 1080 × 2424 at 420 dpi
- Density normalization: native 1080 px viewport used for both implementation states

**Findings**

- No actionable P0/P1/P2 differences remain for the requested change.
- Spacing and layout: the banner's native bounds are `[338,184][742,279]`, giving it an x-center of 540 px, exactly matching the 1080 px viewport center. The profile and notification controls remain independently anchored at the edges.
- Scroll behavior: the banner is visible in the centered top position at scroll offset zero and leaves the viewport with the wallet content after scrolling. The profile, notification button, glass background, divider, and compact balance title remain fixed.
- Fonts and typography: unchanged from the existing component.
- Colors and visual tokens: unchanged from the existing component.
- Image quality and asset fidelity: no image assets were changed.
- Copy and content: unchanged.

**Full-view evidence**

- The top-state screenshot shows the centered banner aligned with the fixed edge controls.
- The scrolled-state screenshot shows the banner fully absent while the fixed header controls and compact balance title remain visible.

**Focused region comparison evidence**

- A separate crop was unnecessary because the header controls are clearly legible in the full-height comparison.
- Android accessibility inspection confirms the banner remains a clickable control with the accessible name `What's new?`.

**Comparison History**

- Initial finding: the banner shared the right-side action group with the notification button, so the group layout shifted the banner away from the viewport center.
- First fix: centered the banner independently from the notification control.
- Follow-up finding: the centered banner was still owned by the fixed navigation layer.
- Follow-up fix: moved the banner into an in-flow scrollable header slot that visually shares the initial top row, while leaving the profile and notification controls in the fixed navigation layer.
- Post-fix evidence: native banner x-center is 540 px on a 1080 px viewport at the top and it is no longer visible after scrolling; lint and TypeScript checks pass.

**Implementation Checklist**

- [x] Center the banner against the viewport.
- [x] Make the banner scroll with page content.
- [x] Preserve profile and notification positioning.
- [x] Preserve banner interaction and accessibility.
- [x] Run lint and TypeScript validation.

**Follow-up Polish**

- None required for this scoped change.

final result: passed
