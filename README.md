# Pseudo Mica

**Pseudo Mica** brings native window translucency effects to Obsidian.

## Usage

- Click the **layers** icon in the ribbon, or
- Open the command palette and run **Pseudo Mica: Open settings**.

## Installation

**From the Obsidian Community Plugins browser:**

1. Open **Settings → Community plugins** and disable Safe Mode if prompted.
2. Click **Browse** and search for **Pseudo Mica**.
3. Click **Install**, then **Enable**.

**Manual installation:**

1. Download `main.js` and `manifest.json` from the [latest release](../../releases/latest).
2. Copy them into your vault at `.obsidian/plugins/pseudo-mica/`.
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## How It Works

Pseudo Mica uses [Electron's native window APIs](https://www.electronjs.org/docs/latest/api/browser-window) to apply OS-native translucency effects.

### Windows

Calls [`setBackgroundMaterial()`](https://www.electronjs.org/docs/latest/api/browser-window#winsetbackgroundmaterialmaterial-windows) with your choice of **Mica**, **Mica Alt**, or **Acrylic**, and adds `is-translucent` class to `body`, mirroring Obsidian's behavior when **Translucent window** option is enabled on macOS.

Requires Obsidian in **Hidden** or **Obsidian frame** in **Apperance** settings.

### macOS

Calls [`setVibrancy()`](https://www.electronjs.org/docs/latest/api/browser-window#winsetvibrancytype-options-macos) with one of the supported vibrancy types (e.g. `sidebar`, `window`, `under-window`).

Overrides **Translucent window** in **Apperance** settings.

## License

Pseudo Mica is licensed under the [MIT license](LICENSE).

---

_This plugin was built entirely with **GitHub Copilot**, powered by **Claude Sonnet 3.7** and **Claude Sonnet 4.6**._
