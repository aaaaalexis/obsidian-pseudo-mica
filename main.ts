import { App, Notice, Platform, Plugin, PluginSettingTab, Setting } from "obsidian";

type MaterialType = "none" | "mica" | "tabbed" | "acrylic";

interface BrowserWindow {
  setBackgroundMaterial(material: MaterialType): void;
}

interface PseudoMicaSettings {
  backgroundMaterial: MaterialType;
}

const DEFAULT_SETTINGS: PseudoMicaSettings = { backgroundMaterial: "mica" };

export default class PseudoMicaPlugin extends Plugin {
  settings: PseudoMicaSettings;
  private electronWindow: BrowserWindow | null = null;

  async onload() {
    await this.loadSettings();

    if (!Platform.isWin) return;

    this.electronWindow = this.getElectronWindow();

    if (this.electronWindow) {
      this.applyBackgroundMaterial();
    }

    document.body.classList.add("is-translucent");
    document.body.style.setProperty("--workspace-background-translucent", "transparent", "important");

    if (document.body.classList.contains("is-hidden-frameless")) {
      document.body.style.setProperty("--titlebar-background", "transparent", "important");
      document.body.style.setProperty("--titlebar-background-focused", "transparent", "important");
    }

    this.addSettingTab(new PseudoMicaSettingTab(this.app, this));
    this.addCommand({
      id: "cycle-background-material",
      name: "Cycle background material",
      callback: () => this.cycleBackgroundMaterial(),
    });
  }

  onunload() {
    document.body.classList.remove("is-translucent");
    document.body.style.removeProperty("--workspace-background-translucent");

    if (document.body.classList.contains("is-hidden-frameless")) {
      document.body.style.removeProperty("--titlebar-background");
      document.body.style.removeProperty("--titlebar-background-focused");
    }

    this.electronWindow?.setBackgroundMaterial?.("none");
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

  private cycleBackgroundMaterial() {
    const materials: MaterialType[] = ["mica", "tabbed", "acrylic"];
    const nextIndex = (materials.indexOf(this.settings.backgroundMaterial) + 1) % materials.length;

    this.settings.backgroundMaterial = materials[nextIndex];
    this.saveSettings();
    this.applyBackgroundMaterial();

    new Notice(`Background material: ${this.settings.backgroundMaterial}`);
  }
}

class PseudoMicaSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: PseudoMicaPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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
          })
      );
  }
}
