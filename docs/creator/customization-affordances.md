# Hyperfy Customization Affordances

The creator experience now exposes a unified set of affordances for tailoring Hyperfy to a wide spectrum of accessibility and productivity needs.

## Theming tokens

- **Motion presets** – switch between `System`, `Comfortable`, and `Reduced` to drive the transition timing and easing tokens used by inspectors, dialogs, and overlays.
- **Typography scale** – increase baseline typography for large and extra-large presets without touching individual component styles.
- **Interaction states** – hover, active, and focus rings inherit their color from the high-contrast toggle and hue sliders for consistent affordances.
- **Colorblind filters** – calibrated filters (protanopia, deuteranopia, tritanopia) can be enabled per-user without affecting global viewers.

All tokens propagate through inspector panes, dialogs, and the command palette automatically.

## Discoverability & onboarding

- **Contextual help center** (Shift+/ by default) provides a searchable knowledge base, quick links into relevant panes, and live shortcut listings.
- **Command palette** (Ctrl/Cmd+K) exposes quick actions such as restarting tours, opening preferences, or toggling overlays.
- **Guided tours** auto-trigger in inspector and dialog flows the first time a creator visits them, and can be restarted from the command palette or Controls menu.
- **Text-to-speech narration** optionally announces tour steps and help center context using the Web Speech API.

## Input remapping

Under **Menu → Controls** creators can record new bindings for:

- Opening the creator menu
- Launching the command palette
- Toggling the contextual help panel
- Displaying the keyboard overlay
- Starting or stopping onboarding tours

Bindings update immediately and can be reset to defaults with Backspace while recording.

## Builder motion prototype

When build mode activates, the dashboard renders a lightweight WebGL shader overlay that respects the selected motion preset while staying within the existing frame budget.
