# UI Telemetry and Preferences

The client now records lightweight telemetry so you can gauge how responsive the UI feels when players tweak their settings. All events are stored in `world.telemetry.entries` while the session is active, making them easy to inspect from the developer console (`world.telemetry.entries.at(-1)` shows the latest entry).

## Event catalogue

* `theme-applied` — fired after the active theme variables have been written to the document. Includes the resolved theme mode (`dark`, `light`, or `system`) and the time in milliseconds between the preference change and the browser painting a new frame.
* `prefs-change-applied` — emitted once UI-related preferences (scale, actions, theme hues, etc.) propagate through the React layer. The payload lists the unique preference keys that changed during the animation frame and the duration required for React to commit the update.
* `persisted` — produced by `ClientPrefs` after the two-second safety delay when values are flushed to local storage. The snapshot contains the persisted theme settings alongside the duration of the write.

You can clear the rolling telemetry buffer manually by reassigning `world.telemetry.entries.length = 0` if you want a fresh capture during profiling.

## Theme preferences

Theme-related preferences now live alongside the existing UI scale and graphics options:

* `world.prefs.themeMode` (`dark`, `light`, or `system`)
* `world.prefs.themeHuePrimary` (accent hue in degrees)
* `world.prefs.themeHueNeutral` (base surface hue in degrees)

They are persisted automatically and can be modified from the **Menu → UI → Appearance** section or programmatically by calling `world.prefs.setThemeMode`/`setThemeHuePrimary`/`setThemeHueNeutral`.

When the theme mode is set to `system`, the client listens for `prefers-color-scheme` changes and reapplies tokens on the fly, which also surfaces in the telemetry stream via `theme-applied` events.
