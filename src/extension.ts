import * as vscode from "vscode";
import { getBlockingDiagnostics, TriggerMode } from "./diagnostics";
import { SoundPlayer } from "./player";

const CONFIG_NAMESPACE = "tikiTikiCodeAlert";
const TOGGLE_COMMAND = "tikiTikiCodeAlert.toggle";
const TEST_SOUND_COMMAND = "tikiTikiCodeAlert.testSound";
const SELECT_CUSTOM_SOUND_COMMAND = "tikiTikiCodeAlert.selectCustomSound";
const SILENCE_COMMAND = "tikiTikiCodeAlert.silence";

export function activate(context: vscode.ExtensionContext): void {
  const controller = new TikiTikiController(context);
  context.subscriptions.push(controller);
}

export function deactivate(): void {}

class TikiTikiController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly player: SoundPlayer;
  private readonly statusBar: vscode.StatusBarItem;
  private pendingTimer: NodeJS.Timeout | undefined;
  private lastPlayedAt = 0;
  private lastEditWithProblemAt = 0;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.player = new SoundPlayer(context);
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
    this.statusBar.command = TOGGLE_COMMAND;

    this.disposables.push(
      this.player,
      this.statusBar,
      vscode.workspace.onDidChangeTextDocument((event) => this.handleTextChanged(event)),
      vscode.languages.onDidChangeDiagnostics((event) => this.handleDiagnosticsChanged(event)),
      vscode.window.onDidChangeActiveTextEditor(() => this.handleActiveEditorChanged()),
      vscode.workspace.onDidChangeConfiguration((event) => this.handleConfigurationChanged(event)),
      vscode.commands.registerCommand(TOGGLE_COMMAND, () => this.toggleEnabled()),
      vscode.commands.registerCommand(TEST_SOUND_COMMAND, () => this.testSound()),
      vscode.commands.registerCommand(SELECT_CUSTOM_SOUND_COMMAND, () => this.selectCustomSound()),
      vscode.commands.registerCommand(SILENCE_COMMAND, () => this.silence())
    );

    this.refreshStatus();
  }

  public dispose(): void {
    this.cancelPendingTimer();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private handleTextChanged(event: vscode.TextDocumentChangeEvent): void {
    if (!event.contentChanges.length || !this.isEnabled() || !this.isActiveDocument(event.document)) {
      return;
    }

    const problemCount = this.getActiveProblemCount(event.document.uri);
    this.refreshStatus(problemCount);

    if (problemCount === 0) {
      this.silence();
      return;
    }

    this.lastEditWithProblemAt = Date.now();
    this.scheduleBuildup();
  }

  private handleDiagnosticsChanged(event: vscode.DiagnosticChangeEvent): void {
    const activeUri = vscode.window.activeTextEditor?.document.uri;

    if (!activeUri || !event.uris.some((uri) => uri.toString() === activeUri.toString())) {
      return;
    }

    const problemCount = this.getActiveProblemCount(activeUri);
    this.refreshStatus(problemCount);

    if (problemCount === 0) {
      this.silence();
    }
  }

  private handleActiveEditorChanged(): void {
    this.silence();
    this.refreshStatus();
  }

  private handleConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration(CONFIG_NAMESPACE)) {
      return;
    }

    if (!this.isEnabled()) {
      this.silence();
    }

    this.refreshStatus();
  }

  private scheduleBuildup(): void {
    const now = Date.now();

    if (this.pendingTimer || now - this.lastPlayedAt < this.getCooldownMs()) {
      return;
    }

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = undefined;
      void this.playIfStillBroken();
    }, this.getDelayMs());
  }

  private async playIfStillBroken(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const activeUri = vscode.window.activeTextEditor?.document.uri;

    if (!activeUri) {
      return;
    }

    const problemCount = this.getActiveProblemCount(activeUri);
    this.refreshStatus(problemCount);

    const now = Date.now();
    const editedRecently = now - this.lastEditWithProblemAt <= Math.max(this.getDelayMs() + 1500, 2000);
    const cooldownReady = now - this.lastPlayedAt >= this.getCooldownMs();

    if (problemCount > 0 && editedRecently && cooldownReady) {
      this.lastPlayedAt = now;
      await this.player.play(this.getCustomSoundFile());
    }
  }

  private async toggleEnabled(): Promise<void> {
    const enabled = this.isEnabled();
    await this.getConfiguration().update("enabled", !enabled, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(`Tiki Tiki Code Alert ${enabled ? "disabled" : "enabled"}.`);
  }

  private async testSound(): Promise<void> {
    await this.player.play(this.getCustomSoundFile());
  }

  private async selectCustomSound(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: "Use Sound",
      title: "Select a licensed sound file",
      filters: {
        Audio: ["wav", "mp3", "m4a", "aac", "aiff", "flac", "ogg"],
        "All Files": ["*"]
      }
    });

    const soundUri = picked?.[0];
    if (!soundUri) {
      return;
    }

    await this.getConfiguration().update("customSoundFile", soundUri.fsPath, vscode.ConfigurationTarget.Global);

    const action = await vscode.window.showInformationMessage(
      "Tiki Tiki Code Alert custom sound saved.",
      "Test Sound"
    );

    if (action === "Test Sound") {
      await this.player.play(soundUri.fsPath);
    }
  }

  private silence(): void {
    this.cancelPendingTimer();
    this.player.stop();
  }

  private cancelPendingTimer(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = undefined;
    }
  }

  private getActiveProblemCount(uri: vscode.Uri): number {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return getBlockingDiagnostics(diagnostics, this.getTriggerMode()).length;
  }

  private refreshStatus(problemCount = this.getCurrentProblemCount()): void {
    if (!this.isStatusBarEnabled()) {
      this.statusBar.hide();
      return;
    }

    if (!this.isEnabled()) {
      this.statusBar.text = "$(mute) Tiki muted";
      this.statusBar.tooltip = "Tiki Tiki Code Alert is disabled.";
      this.statusBar.show();
      return;
    }

    if (problemCount > 0) {
      this.statusBar.text = `$(bell) Tiki ${problemCount}`;
      this.statusBar.tooltip = `${problemCount} active error${problemCount === 1 ? "" : "s"} in the current file.`;
      this.statusBar.show();
      return;
    }

    this.statusBar.text = "$(check) Tiki";
    this.statusBar.tooltip = "Watching the active file for continued editing with errors.";
    this.statusBar.show();
  }

  private getCurrentProblemCount(): number {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    return activeUri ? this.getActiveProblemCount(activeUri) : 0;
  }

  private isActiveDocument(document: vscode.TextDocument): boolean {
    return vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString();
  }

  private isEnabled(): boolean {
    return this.getConfiguration().get<boolean>("enabled", true);
  }

  private isStatusBarEnabled(): boolean {
    return this.getConfiguration().get<boolean>("statusBarEnabled", true);
  }

  private getDelayMs(): number {
    return sanitizeNumber(this.getConfiguration().get<number>("delayMs", 1500), 0, 10000);
  }

  private getCooldownMs(): number {
    return sanitizeNumber(this.getConfiguration().get<number>("cooldownMs", 3500), 500, 60000);
  }

  private getTriggerMode(): TriggerMode {
    const mode = this.getConfiguration().get<string>("triggerMode", "errors");
    return mode === "syntaxLike" ? "syntaxLike" : "errors";
  }

  private getCustomSoundFile(): string {
    return this.getConfiguration().get<string>("customSoundFile", "");
  }

  private getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
  }
}

function sanitizeNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
