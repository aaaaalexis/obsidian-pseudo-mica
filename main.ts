import { App, Notice, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";

type MaterialType = "none" | "mica" | "tabbed" | "acrylic";
type VibrancyType = "titlebar" | "selection" | "menu" | "popover" | "sidebar" | "header" | "sheet" | "window" | "hud" | "fullscreen-ui" | "tooltip" | "content" | "under-window" | "under-page" | null;

interface BrowserWindow {
  setBackgroundMaterial(material: MaterialType): void;
  setVibrancy(type: VibrancyType, options?: { animationDuration?: number }): void;
}

interface PseudoMicaSettings {
  backgroundMaterial: MaterialType;
  vibrancy: VibrancyType;
}

const DEFAULT_SETTINGS: PseudoMicaSettings = {
  backgroundMaterial: "mica",
  vibrancy: "window",
};

export default class PseudoMicaPlugin extends Plugin {
  settings: PseudoMicaSettings;
  private electronWindow: BrowserWindow | null = null;

  async onload() {
    await this.loadSettings();

    this.electronWindow = this.getElectronWindow();

    if (!this.electronWindow) return;

    if (Platform.isWin) {
      this.applyBackgroundMaterial();
      document.body.classList.add("is-translucent");
      document.body.style.setProperty("--workspace-background-translucent", "transparent", "important");

      if (document.body.classList.contains("is-hidden-frameless")) {
        document.body.style.setProperty("--titlebar-background", "transparent", "important");
        document.body.style.setProperty("--titlebar-background-focused", "transparent", "important");
      }
    } else if (Platform.isMacOS) {
      this.applyVibrancy();
    }

    this.addSettingTab(new PseudoMicaSettingTab(this.app, this));
    this.addCommand({
      id: "cycle-background-material",
      name: "Cycle background material",
      callback: () => this.cycleBackgroundMaterial(),
    });
  }

  onunload() {
    if (Platform.isWin) {
      document.body.classList.remove("is-translucent");
      document.body.style.removeProperty("--workspace-background-translucent");

      if (document.body.classList.contains("is-hidden-frameless")) {
        document.body.style.removeProperty("--titlebar-background");
        document.body.style.removeProperty("--titlebar-background-focused");
      }

      this.electronWindow?.setBackgroundMaterial?.("none");
    } else if (Platform.isMacOS) {
      this.electronWindow?.setVibrancy?.(null);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private getElectronWindow(): BrowserWindow | null {
    try {
      return require("@electron/remote")?.getCurrentWindow() || (window as any).require?.("@electron/remote")?.getCurrentWindow() || null;
    } catch {
      return null;
    }
  }

  applyBackgroundMaterial() {
    try {
      this.electronWindow?.setBackgroundMaterial?.(this.settings.backgroundMaterial);
    } catch (error) {
      console.error("Error applying background material:", error);
    }
  }

  applyVibrancy() {
    try {
      this.electronWindow?.setVibrancy?.(this.settings.vibrancy, { animationDuration: 200 });
    } catch (error) {
      console.error("Error applying vibrancy:", error);
    }
  }

  private cycleBackgroundMaterial() {
    if (Platform.isWin) {
      const materials: MaterialType[] = ["mica", "tabbed", "acrylic"];
      const nextIndex = (materials.indexOf(this.settings.backgroundMaterial) + 1) % materials.length;

      this.settings.backgroundMaterial = materials[nextIndex];
      this.saveSettings();
      this.applyBackgroundMaterial();

      new Notice(`Background material: ${this.settings.backgroundMaterial}`);
    } else if (Platform.isMacOS) {
      const vibrancies: VibrancyType[] = ["titlebar", "selection", "menu", "popover", "sidebar", "header", "sheet", "window", "hud", "tooltip", "content"];
      const currentIndex = vibrancies.indexOf(this.settings.vibrancy as VibrancyType);
      const nextIndex = (currentIndex + 1) % vibrancies.length;

      this.settings.vibrancy = vibrancies[nextIndex];
      this.saveSettings();
      this.applyVibrancy();

      new Notice(`Vibrancy: ${this.settings.vibrancy}`);
    }
  }
}

class PseudoMicaSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: PseudoMicaPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    if (Platform.isWin) {
      new Setting(containerEl)
        .setName("Background Material")
        .setDesc("Requires Hidden or Obsidian frame style in Apperance settings.")
        .addDropdown((dropdown) =>
          dropdown
            .addOptions({
              mica: "Mica",
              tabbed: "Mica Alt",
              acrylic: "Acrylic",
            })
            .setValue(this.plugin.settings.backgroundMaterial)
            .onChange(async (value: MaterialType) => {
              this.plugin.settings.backgroundMaterial = value;
              await this.plugin.saveSettings();
              this.plugin.applyBackgroundMaterial();
            }),
        );
    } else if (Platform.isMacOS) {
      new Setting(containerEl)
        .setName("Vibrancy Effect")
        .setDesc("Choose a vibrancy effect for the window.")
        .addDropdown((dropdown) =>
          dropdown
            .addOptions({
              titlebar: "Titlebar",
              selection: "Selection",
              menu: "Menu",
              popover: "Popover",
              sidebar: "Sidebar",
              header: "Header",
              sheet: "Sheet",
              window: "Window",
              hud: "HUD",
              tooltip: "Tooltip",
              content: "Content",
              "under-window": "Under Window",
              "under-page": "Under Page",
            })
            .setValue(this.plugin.settings.vibrancy || "window")
            .onChange(async (value: string) => {
              this.plugin.settings.vibrancy = value as VibrancyType;
              await this.plugin.saveSettings();
              this.plugin.applyVibrancy();
            }),
        );
    }
  }
}
