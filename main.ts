import { Plugin, Platform, PluginSettingTab, App, Setting } from "obsidian";
import { promisify } from "util";
import * as fs from "fs/promises";

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Define settings interface
interface PseudoMicaSettings {
  blurSize: number;
}

// Define default settings
const DEFAULT_SETTINGS: PseudoMicaSettings = {
  blurSize: 240,
};

type EdgeParams = [number, number, number, number, number, number, number, number];

// Modify function to accept blurSize
async function processWallpaperImage(imagePath: string, targetWidth: number, targetHeight: number, blurSize: number): Promise<string> {
  const BLUR_SIZE = blurSize;
  const BLUR_PASSES = 3;

  // Create all canvases upfront
  const workCanvas = document.createElement("canvas");
  const workCtx = workCanvas.getContext("2d", { alpha: false })!;

  // Load and process image
  const imageData = await fs.readFile(imagePath);
  const img = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(new Blob([imageData]));
  });

  // Set dimensions once
  workCanvas.width = img.width + BLUR_SIZE * 2;
  workCanvas.height = img.height + BLUR_SIZE * 2;

  // Optimize rendering
  workCtx.imageSmoothingQuality = "high";

  // Draw and extend image in one pass
  workCtx.drawImage(img, BLUR_SIZE, BLUR_SIZE);

  // Extend edges more efficiently
  const edges: EdgeParams[] = [
    [BLUR_SIZE, BLUR_SIZE, img.width, 1, BLUR_SIZE, 0, img.width, BLUR_SIZE],
    [BLUR_SIZE, img.height + BLUR_SIZE - 1, img.width, 1, BLUR_SIZE, img.height + BLUR_SIZE, img.width, BLUR_SIZE],
    [BLUR_SIZE, BLUR_SIZE, 1, img.height, 0, BLUR_SIZE, BLUR_SIZE, img.height],
    [img.width + BLUR_SIZE - 1, BLUR_SIZE, 1, img.height, img.width + BLUR_SIZE, BLUR_SIZE, BLUR_SIZE, img.height],
  ];

  edges.forEach((params) => workCtx.drawImage(workCanvas, ...params));

  // Corners in one pass
  const corner = workCtx.getImageData(BLUR_SIZE, BLUR_SIZE, 1, 1);
  const cornerPositions = [
    [0, 0],
    [img.width + BLUR_SIZE, 0],
    [0, img.height + BLUR_SIZE],
    [img.width + BLUR_SIZE, img.height + BLUR_SIZE],
  ];

  cornerPositions.forEach(([x, y]) => workCtx.putImageData(corner, x, y));

  // Optimized blur
  const blurSizeAdjusted = BLUR_SIZE / Math.sqrt(3);
  workCtx.filter = `blur(${blurSizeAdjusted}px)`;
  for (let i = 0; i < BLUR_PASSES; i++) {
    workCtx.drawImage(workCanvas, 0, 0);
  }

  // Final processing: output blurred image at original dimensions
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = img.width; // Use original image width
  finalCanvas.height = img.height; // Use original image height
  const finalCtx = finalCanvas.getContext("2d", { alpha: false })!;

  // Draw the processed (blurred) portion of the workCanvas, corresponding to the original image,
  // onto the finalCanvas without scaling.
  finalCtx.drawImage(workCanvas, BLUR_SIZE, BLUR_SIZE, img.width, img.height, 0, 0, img.width, img.height);

  URL.revokeObjectURL(img.src);
  return finalCanvas.toDataURL("image/jpeg", 0.9).split(",")[1];
}

export default class PseudoMica extends Plugin {
  settings: PseudoMicaSettings;
  private styleEl = document.createElement("style");
  private readonly exec = promisify(require("child_process").exec);
  private lastPosition: Position = { x: 0, y: 0, width: 0, height: 0 };
  private frameRequest: number | null = null;
  private resizeTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new PseudoMicaSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      if (this.isInitialized || !Platform.isWin) return;

      this.isInitialized = true;
      await this.initializeWallpaper();
      document.body.classList.add("is-translucent");
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (this.isInitialized) {
      this.styleEl.remove();
      document.body.classList.remove("is-translucent");
      this.isInitialized = false;
      this.app.workspace.onLayoutReady(async () => {
        if (this.isInitialized || !Platform.isWin) return;
        this.isInitialized = true;
        await this.initializeWallpaper();
        document.body.classList.add("is-translucent");
      });
    }
  }

  private async initializeWallpaper() {
    const wallpaperPath = await this.getWallpaperPath();
    if (!wallpaperPath) return;

    window.requestIdleCallback(async () => {
      try {
        const base64Image = await processWallpaperImage(wallpaperPath, window.screen.width, window.screen.height, this.settings.blurSize);

        // Define CSS variables for transform values
        document.body.style.setProperty("--pseudo-mica-translate-x", "0px");
        document.body.style.setProperty("--pseudo-mica-translate-y", "0px");
        document.body.style.setProperty("--pseudo-mica-screen-width", `${window.screen.width}px`);
        document.body.style.setProperty("--pseudo-mica-screen-height", `${window.screen.height}px`);

        const styles = `
                  body {
                      --titlebar-background-focused: transparent;
                  }
                  body::before {
                      width: var(--pseudo-mica-screen-width);
                      height: var(--pseudo-mica-screen-height);
                      background-image: url(data:image/jpeg;base64,${base64Image});
                      position: fixed;
                      transform-origin: top left;
                      z-index: -1;
                      background-position: center;
                      background-size: cover;
                      content: "";
                      /* Use CSS variables for transform and hint for optimization */
                      transform: translate(var(--pseudo-mica-translate-x, 0px), var(--pseudo-mica-translate-y, 0px));
                      will-change: transform;
                  }
                      
                  .is-translucent:not(.is-fullscreen) .titlebar {
                      background-color: transparent;
                  }`;

        document.head.appendChild(this.styleEl);
        this.styleEl.textContent = styles;

        this.setupPositionTracking(); // Pass no arguments
      } catch (error) {
        console.error("Failed to set wallpaper background:", error);
      }
    });
  }

  private setupPositionTracking() {

    // Calculates position of current app monitor in whole screen matrix
    const getCurrentDisplayPositions = () => {
      const currentWindow = electron.remote.getCurrentWindow()
      const currentDisplay = electron.remote.screen.getDisplayMatching(currentWindow.getBounds())
      return { x: currentDisplay.bounds.x, y: currentDisplay.bounds.y }
    }

    // Removed 'styles' parameter
    const updatePosition = () => {
      const { screenX, screenY } = window;
      if (this.lastPosition.x !== screenX || this.lastPosition.y !== screenY) {

        const displayPositions = getCurrentDisplayPositions()
        Object.assign(this.lastPosition, { x: screenX, y: screenY });
        // Update CSS variables directly on the body's style
        document.body.style.setProperty("--pseudo-mica-translate-x", `${-screenX+displayPositions.x}px`);
        document.body.style.setProperty("--pseudo-mica-translate-y", `${-screenY+displayPositions.y}px`);
      }
      this.frameRequest = requestAnimationFrame(updatePosition);
    };

    const updateSize = () => {
      const { width: screenWidth, height: screenHeight } = window.screen;
      
      // Screen size changed due to monitor change
      if (this.lastPosition.width !== screenWidth || this.lastPosition.height !== screenHeight) {
        Object.assign(this.lastPosition, { width: screenWidth, height: screenHeight })
        document.body.style.setProperty("--pseudo-mica-screen-width", `${screenWidth}px`);
        document.body.style.setProperty("--pseudo-mica-screen-height", `${screenHeight}px`);
      }
      this.frameRequest = requestAnimationFrame(updatePosition);
    }

    const handleResize = () => {
      this.resizeTimer && clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        // Ensure position is updated on resize completion
        updatePosition();
        // Potentially re-initialize if screen dimensions for wallpaper change significantly
        // For now, just update position. If wallpaper re-rendering on resize is needed,
        // that would be a more complex change involving re-calling initializeWallpaper logic.
        updateSize();
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    // Initial position update
    updatePosition();

    this.register(() => {
      this.frameRequest && cancelAnimationFrame(this.frameRequest);
      this.resizeTimer && clearTimeout(this.resizeTimer);
      window.removeEventListener("resize", handleResize);
      this.styleEl.remove();
      // Clean up CSS variables if necessary
      document.body.style.removeProperty("--pseudo-mica-translate-x");
      document.body.style.removeProperty("--pseudo-mica-translate-y");
      document.body.style.removeProperty("--pseudo-mica-screen-width");
      document.body.style.removeProperty("--pseudo-mica-screen-height");
    });
  }

  private async getWallpaperPath(): Promise<string> {
    if (!Platform.isWin) return "";
    try {
      const { stdout } = await this.exec(`powershell -command "(Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper).Wallpaper"`);
      return stdout.trim();
    } catch {
      return "";
    }
  }
}

class PseudoMicaSettingTab extends PluginSettingTab {
  plugin: PseudoMica;

  constructor(app: App, plugin: PseudoMica) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    if (Platform.isWin) {
      new Setting(containerEl).setHeading().setName("Pseudo Mica");
    } else {
      new Setting(containerEl).setHeading().setName("Pseudo Mica is disabled on this device").setDesc("Effect only available on Windows.");
    }

    new Setting(containerEl)
      .setName("Blur Intensity")
      .setDesc("Amount of blur applied to the wallpaper background. Higher values may slightly increase initial processing time. Requires restart or settings change to apply.")
      .addSlider((slider) =>
        slider
          .setLimits(10, 500, 10)
          .setValue(this.plugin.settings.blurSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.blurSize = value;
            await this.plugin.saveSettings();
          })
      )
      .addExtraButton((button) => {
        button.setIcon("reset").onClick(async () => {
          this.plugin.settings.blurSize = DEFAULT_SETTINGS.blurSize;
          await this.plugin.saveSettings();
          this.display();
        });
      });
  }
}
