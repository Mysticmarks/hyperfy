# Performance Stats HUD

The in-world performance overlay exposes real-time CPU, GPU, and network timings. Builders use the
HUD to validate frame budgets, highlight GPU/CPU regressions, and monitor ping while iterating on
world scripts.

## Palette Options

Two colour palettes are now available so the HUD can adapt to accessibility needs and mixed
WebGL/WebGPU workflows:

| Palette | FPS | CPU | GPU (WebGL) | GPU (WebGPU) | Compute (WebGPU) | Ping |
| --- | --- | --- | --- | --- | --- | --- |
| Classic (default) | Cyan on deep navy | Green on dark green | Yellow on maroon | Bright blue on midnight blue | Lavender on plum | Red on burgundy |
| High Contrast | Electric cyan on charcoal | Neon green on forest | Soft yellow on espresso | Sky blue on midnight | Magenta on wine | Coral on oxblood |

The renderer automatically selects the correct GPU/compute swatch for the active backend. Colours are
stored in user preferences and reload with the rest of the client settings.

## Changing the Palette

You can change the palette from either of the existing preference surfaces:

- **Sidebar → Preferences → Interface → Stats Palette** – cycling with the arrow buttons updates the
  palette immediately.
- **Main Menu → UI → Stats Palette** – identical control for users navigating via the menu overlay.

Palette choices persist across sessions (stored in local client preferences) and apply as soon as the
performance HUD is visible. The ping panel inherits the same palette for clarity.

## Tips

- When profiling WebGPU scenes alongside WebGL fallbacks, switch to the high contrast palette to make
  GPU contexts visually distinct.
- Pair palette changes with the HUD visibility toggle (``/stats`` chat command or UI toggle) when
  screen captures need alternative colourways for documentation.
