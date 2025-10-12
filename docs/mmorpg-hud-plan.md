# Player HUD Improvement Plan

## Existing Capabilities to Leverage
- **UI node system** – The [`ui` node](./scripting/nodes/types/UI.md) already supports world-space and screen-space layouts, pivot controls, offsets, scaling helpers, and pointer toggle flags, allowing teams to anchor overlays and information cards precisely where they need them.
- **Composable primitives** – Additional nodes such as [`uiimage`](./scripting/nodes/types/UIImage.md) and [`uiview`](./scripting/nodes/types/UIView.md) provide reusable primitives for text, images, and containers, giving authors a baseline toolkit for assembling HUD panels without bespoke rendering code.
- **Configurable apps** – App scripts can expose configurable props so designers can tweak HUD behavior without code edits, letting a single HUD package serve multiple experiences.

## Gaps Called Out in the MMORPG Roadmap
- **Input & accessibility foundations** – The [MMORPG Readiness Roadmap](./mmorpg-roadmap.md) highlights the need for controller support, remappable keybinds, and accessibility settings like UI scaling and color adjustments before the HUD is ready for a broad MMORPG audience. These are prerequisites for inclusive interface design.
- **Feature module coverage** – Inventory, quest tracking, combat logs, and party frames are not shipped as first-party systems. Teams must currently assemble these from primitives for every project, leading to fragmentation and inconsistent UX.

## Recommended Initiatives
1. **HUD design system pass**
   - Establish shared typography, color tokens, spacing, and widget patterns specifically for HUD use-cases.
   - Ship helper components (e.g., `StatusBar`, `NotificationToast`, `ActionHotbar`) built on existing UI nodes so teams consume a consistent, themeable library.

2. **Accessibility and input upgrades**
   - Prioritize implementation of global UI scaling, color-blind safe themes, and customizable control bindings, fulfilling the roadmap's accessibility goals.
   - Provide runtime APIs so HUD modules can query player accessibility preferences and adjust their layouts automatically.

3. **Reusable feature modules**
   - Develop packaged HUD apps for quests, parties, combat feedback, and inventory that expose props for game-specific data feeds.
   - Document integration points and data contracts so backend/gameplay teams can plug existing systems into these HUD packages without rewriting UI logic.

## Next Steps
- Sequence the accessibility/input work first so any new HUD modules launch with inclusive foundations.
- In parallel, start the design system exploration and publish shared guidelines, followed by implementation of reusable HUD widgets.
- Once the base components are ready, layer in the higher-level feature modules and capture learnings in the scripting documentation.
