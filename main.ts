import { App, FuzzySuggestModal, Modal, Platform, Plugin, Setting } from "obsidian";

function t(key: string, fallback: string): string {
  return (window as any).i18next?.t(key) ?? fallback;
}

type MaterialType = "none" | "mica" | "tabbed" | "acrylic";
type VibrancyType = "titlebar" | "selection" | "menu" | "popover" | "sidebar" | "header" | "sheet" | "window" | "hud" | "fullscreen-ui" | "tooltip" | "content" | "under-window" | "under-page" | null;

interface BrowserWindow {
  setBackgroundMaterial(material: MaterialType): void;
  setVibrancy(type: VibrancyType): void;
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
  settings: PseudoMicaSettings;
  private electronWindow: BrowserWindow | null = null;

  async onload() {
    await this.loadSettings();

    this.electronWindow = this.getElectronWindow();

    if (!this.electronWindow) return;

    if (Platform.isWin) {
      this.applyMaterial();
      document.body.classList.add("is-translucent");
      document.body.style.setProperty("--workspace-background-translucent", "transparent", "important");
      document.body.style.setProperty("--titlebar-background", "transparent", "important");
      document.body.style.setProperty("--titlebar-background-focused", "transparent", "important");
    } else if (Platform.isMacOS) {
      this.applyVibrancy();
    }

    const openSettings = () => {
      if (Platform.isWin) new PseudoMicaMaterialModal(this.app, this).open();
      else if (Platform.isMacOS) {
        if (!document.body.classList.contains("is-translucent")) new TranslucencyPromptModal(this.app, () => new PseudoMicaVibrancyModal(this.app, this).open()).open();
        else new PseudoMicaVibrancyModal(this.app, this).open();
      }
    };

    const effectLabel = Platform.isWin ? "Change material" : "Change vibrancy";
    this.addRibbonIcon("layers", effectLabel, openSettings);

    this.addCommand({
      id: "open-pseudo-mica-settings",
      name: effectLabel,
      callback: openSettings,
    });
  }

  onunload() {
    if (Platform.isWin) {
      this.electronWindow?.setBackgroundMaterial?.("none");
      document.body.classList.remove("is-translucent");
      document.body.style.removeProperty("--workspace-background-translucent");
      document.body.style.removeProperty("--titlebar-background");
      document.body.style.removeProperty("--titlebar-background-focused");
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

class TranslucencyPromptModal extends Modal {
  constructor(
    app: App,
    private readonly onContinue: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Pseudo Mica");
    const { modalEl } = this;

    new Setting(modalEl)
      .setName(t("plugins.translucency.name", "Translucent window"))
      .setDesc(t("plugins.translucency.desc", "Turn on translucency effect..."))
      .addToggle((toggle) =>
        toggle.setValue(document.body.classList.contains("is-translucent")).onChange((value) => {
          (this.app as any).vault.setConfig?.("translucency", value);
          document.body.classList.toggle("is-translucent", value);
          if (value) {
            this.close();
            this.onContinue();
          }
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

interface LabeledOption<T extends string> {
  value: T;
  label: string;
}

abstract class PseudoMicaModal<T extends string> extends FuzzySuggestModal<LabeledOption<T>> {
  protected abstract readonly options: LabeledOption<T>[];
  private readonly originalValue: T | null;
  private confirmed = false;

  constructor(
    app: App,
    protected readonly plugin: PseudoMicaPlugin,
    placeholder: string,
  ) {
    super(app);
    this.setPlaceholder(placeholder);
    this.originalValue = this.getSetting();
  }

  protected abstract getSetting(): T | null;
  protected abstract setSetting(value: T | null): void;
  protected abstract applyEffect(): void;

  onOpen(): void {
    super.onOpen();
    const chooser = (this as any).chooser;
    const orig = chooser.setSelectedItem.bind(chooser);
    chooser.setSelectedItem = (index: number, scroll: boolean) => {
      orig(index, scroll);
      const selected = chooser.values?.[index];
      if (selected) {
        this.setSetting(selected.item.value);
        this.applyEffect();
      }
    };
  }

  onClose(): void {
    if (!this.confirmed) {
      this.setSetting(this.originalValue);
      this.applyEffect();
    }
  }

  getItems(): LabeledOption<T>[] {
    return this.options;
  }

  getItemText(item: LabeledOption<T>): string {
    return item.label;
  }

  async onChooseItem(item: LabeledOption<T>): Promise<void> {
    this.confirmed = true;
    this.setSetting(item.value);
    await this.plugin.saveSettings();
    this.applyEffect();
  }
}

class PseudoMicaMaterialModal extends PseudoMicaModal<MaterialType> {
  protected readonly options: LabeledOption<MaterialType>[] = [
    { value: "mica", label: "Mica" },
    { value: "tabbed", label: "Mica Alt" },
    { value: "acrylic", label: "Acrylic" },
  ];

  constructor(app: App, plugin: PseudoMicaPlugin) {
    super(app, plugin, "Select material...");
  }

  protected getSetting(): MaterialType {
    return this.plugin.settings.material;
  }
  protected setSetting(value: MaterialType | null): void {
    if (value) this.plugin.settings.material = value;
  }
  protected applyEffect(): void {
    this.plugin.applyMaterial();
  }
}

class PseudoMicaVibrancyModal extends PseudoMicaModal<NonNullable<VibrancyType>> {
  protected readonly options: LabeledOption<NonNullable<VibrancyType>>[] = [
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
  ];

  constructor(app: App, plugin: PseudoMicaPlugin) {
    super(app, plugin, "Select vibrancy...");
  }

  protected getSetting(): VibrancyType {
    return this.plugin.settings.vibrancy;
  }
  protected setSetting(value: NonNullable<VibrancyType> | null): void {
    this.plugin.settings.vibrancy = value;
  }
  protected applyEffect(): void {
    this.plugin.applyVibrancy();
  }
}
