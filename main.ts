import { App, FuzzySuggestModal, Platform, Plugin } from "obsidian";

type MaterialType = "none" | "mica" | "tabbed" | "acrylic";
type VibrancyType = "titlebar" | "selection" | "menu" | "popover" | "sidebar" | "header" | "sheet" | "window" | "hud" | "fullscreen-ui" | "tooltip" | "content" | "under-window" | "under-page" | null;

interface BrowserWindow {
  setBackgroundMaterial(material: MaterialType): void;
  setVibrancy(type: VibrancyType): void;
}

declare const require: (moduleName: string) => unknown;

interface ObsidianVaultConfig {
  getConfig?(key: "translucency"): boolean;
  setConfig?(key: "translucency", value: boolean): void;
}

interface LabeledOption<T extends string> {
  value: T;
  label: string;
}

interface CustomWindow extends Window {
  require?: (moduleName: string) => unknown;
}

interface FuzzySuggestModalChooser<V extends string> {
  values?: { item: LabeledOption<V> }[];
  setSelectedItem(index: number, scroll: boolean): void;
}

interface PseudoMicaSettings {
  material: MaterialType;
  vibrancy: VibrancyType;
}

const DEFAULT_SETTINGS: PseudoMicaSettings = {
  material: "mica",
  vibrancy: "sidebar",
};

export default class PseudoMicaPlugin extends Plugin {
  settings!: PseudoMicaSettings;
  private electronWindow: BrowserWindow | null = null;

  async onload() {
    await this.loadSettings();

    this.electronWindow = this.getElectronWindow();

    if (!this.electronWindow) return;

    if (Platform.isWin) {
      this.applyMaterial();
      activeDocument.body.classList.add("is-translucent");
      activeDocument.body.setCssProps({
        "--workspace-background-translucent": "transparent",
        "--titlebar-background": "transparent",
        "--titlebar-background-focused": "transparent",
      });
    } else if (Platform.isMacOS) {
      const vault = this.app.vault as unknown as ObsidianVaultConfig;
      if (vault.getConfig && !vault.getConfig("translucency")) {
        vault.setConfig?.("translucency", true);
        activeDocument.body.classList.add("is-translucent");
      }
      this.applyVibrancy();
    }

    const openSettings = () => {
      if (Platform.isWin) {
        new PseudoMicaModal(
          this.app,
          this,
          "Select material...",
          "material",
          [
            { value: "mica", label: "Mica" },
            { value: "tabbed", label: "Mica Alt" },
            { value: "acrylic", label: "Acrylic" },
          ],
          () => this.applyMaterial(),
        ).open();
      } else if (Platform.isMacOS) {
        new PseudoMicaModal(
          this.app,
          this,
          "Select vibrancy...",
          "vibrancy",
          [
            { value: "titlebar", label: "Titlebar" },
            { value: "selection", label: "Selection" },
            { value: "menu", label: "Menu" },
            { value: "popover", label: "Popover" },
            { value: "sidebar", label: "Sidebar" },
            { value: "header", label: "Header" },
            { value: "sheet", label: "Sheet" },
            { value: "window", label: "Window" },
            { value: "hud", label: "HUD" },
            { value: "fullscreen-ui", label: "Fullscreen UI" },
            { value: "tooltip", label: "Tooltip" },
            { value: "content", label: "Content" },
            { value: "under-window", label: "Under Window" },
            { value: "under-page", label: "Under Page" },
          ],
          () => this.applyVibrancy(),
        ).open();
      }
    };

    const effectLabel = Platform.isWin ? "Change material" : "Change vibrancy";
    this.addRibbonIcon("layers", effectLabel, openSettings);

    this.addCommand({
      id: "open-settings",
      name: effectLabel,
      callback: openSettings,
    });
  }

  onunload() {
    if (Platform.isWin) {
      this.electronWindow?.setBackgroundMaterial?.("none");
      activeDocument.body.classList.remove("is-translucent");
      activeDocument.body.setCssProps({
        "--workspace-background-translucent": "",
        "--titlebar-background": "",
        "--titlebar-background-focused": "",
      });
    } else if (Platform.isMacOS) {
      this.electronWindow?.setVibrancy?.(null);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<PseudoMicaSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private getElectronWindow(): BrowserWindow | null {
    try {
      const req = typeof require !== "undefined" ? require : (window as unknown as CustomWindow).require;
      const remote = req?.("@electron/remote") as { getCurrentWindow(): BrowserWindow } | undefined;
      return remote?.getCurrentWindow() ?? null;
    } catch {
      return null;
    }
  }

  applyMaterial() {
    try {
      this.electronWindow?.setBackgroundMaterial?.(this.settings.material);
    } catch (error) {
      console.error("Error applying material:", error);
    }
  }

  applyVibrancy() {
    try {
      this.electronWindow?.setVibrancy?.(this.settings.vibrancy);
    } catch (error) {
      console.error("Error applying vibrancy:", error);
    }
  }
}

class PseudoMicaModal<K extends keyof PseudoMicaSettings> extends FuzzySuggestModal<LabeledOption<PseudoMicaSettings[K] & string>> {
  private readonly originalValue: PseudoMicaSettings[K];
  private confirmed = false;

  constructor(
    app: App,
    private readonly plugin: PseudoMicaPlugin,
    placeholder: string,
    private readonly key: K,
    private readonly options: LabeledOption<PseudoMicaSettings[K] & string>[],
    private readonly applyEffect: () => void,
  ) {
    super(app);
    this.setPlaceholder(placeholder);
    this.originalValue = plugin.settings[key];
  }

  onOpen(): void {
    void super.onOpen();
    const chooser = (this as unknown as { chooser: FuzzySuggestModalChooser<PseudoMicaSettings[K] & string> }).chooser;
    const orig = chooser.setSelectedItem.bind(chooser);
    chooser.setSelectedItem = (index: number, scroll: boolean) => {
      orig(index, scroll);
      const selected = chooser.values?.[index];
      if (selected) {
        this.plugin.settings[this.key] = selected.item.value;
        this.applyEffect();
      }
    };
  }

  onClose(): void {
    if (!this.confirmed) {
      this.plugin.settings[this.key] = this.originalValue;
      this.applyEffect();
    }
  }

  getItems(): LabeledOption<PseudoMicaSettings[K] & string>[] {
    return this.options;
  }

  getItemText(item: LabeledOption<PseudoMicaSettings[K] & string>): string {
    return item.label;
  }

  onChooseItem(item: LabeledOption<PseudoMicaSettings[K] & string>): void {
    this.confirmed = true;
    this.plugin.settings[this.key] = item.value;
    this.plugin.saveSettings().catch((error) => {
      console.error("Failed to save settings:", error);
    });
    this.applyEffect();
  }
}
