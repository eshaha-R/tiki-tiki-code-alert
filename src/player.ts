import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ChildProcess, spawn, spawnSync } from "node:child_process";
import * as vscode from "vscode";
import { createDefaultBuildupWave } from "./audio";

interface PlaybackCommand {
  command: string;
  args: string[];
}

export class SoundPlayer implements vscode.Disposable {
  private currentProcess: ChildProcess | undefined;
  private warnedKeys = new Set<string>();

  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async play(customSoundFile: string | undefined): Promise<void> {
    const soundFile = await this.resolveSoundFile(customSoundFile);
    const playback = this.getPlaybackCommand(soundFile);

    if (!playback) {
      this.warnOnce(
        "missing-linux-player",
        "Tiki Tiki Code Alert could not find a sound player. Install paplay, aplay, ffplay, or sox play."
      );
      return;
    }

    this.stop();

    const child = spawn(playback.command, playback.args, {
      stdio: "ignore",
      windowsHide: true
    });

    this.currentProcess = child;

    child.once("error", (error) => {
      if (this.currentProcess === child) {
        this.currentProcess = undefined;
      }
      this.warnOnce("playback-error", `Tiki Tiki Code Alert could not play audio: ${error.message}`);
    });

    child.once("exit", () => {
      if (this.currentProcess === child) {
        this.currentProcess = undefined;
      }
    });
  }

  public stop(): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill();
    }
    this.currentProcess = undefined;
  }

  public dispose(): void {
    this.stop();
  }

  private async resolveSoundFile(customSoundFile: string | undefined): Promise<string> {
    const expanded = expandHome(customSoundFile?.trim() ?? "");

    if (expanded) {
      if (fs.existsSync(expanded)) {
        return expanded;
      }

      this.warnOnce("missing-custom-sound", `Custom Tiki Tiki sound file was not found: ${expanded}`);
    }

    return this.ensureDefaultSoundFile();
  }

  private async ensureDefaultSoundFile(): Promise<string> {
    const storagePath = this.context.globalStorageUri.fsPath;
    const soundPath = path.join(storagePath, "tiki-tiki-buildup.wav");

    await fs.promises.mkdir(storagePath, { recursive: true });

    if (!fs.existsSync(soundPath)) {
      await fs.promises.writeFile(soundPath, createDefaultBuildupWave());
    }

    return soundPath;
  }

  private getPlaybackCommand(soundFile: string): PlaybackCommand | undefined {
    if (process.platform === "darwin") {
      return { command: "afplay", args: [soundFile] };
    }

    if (process.platform === "win32") {
      const escapedPath = soundFile.replace(/'/g, "''");
      return {
        command: "powershell.exe",
        args: [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `(New-Object System.Media.SoundPlayer '${escapedPath}').PlaySync();`
        ]
      };
    }

    const linuxCandidates: PlaybackCommand[] = [
      { command: "paplay", args: [soundFile] },
      { command: "aplay", args: [soundFile] },
      { command: "ffplay", args: ["-nodisp", "-autoexit", "-loglevel", "quiet", soundFile] },
      { command: "play", args: ["-q", soundFile] }
    ];

    return linuxCandidates.find((candidate) => commandExists(candidate.command));
  }

  private warnOnce(key: string, message: string): void {
    if (this.warnedKeys.has(key)) {
      return;
    }

    this.warnedKeys.add(key);
    void vscode.window.showWarningMessage(message);
  }
}

function expandHome(input: string): string {
  if (!input) {
    return "";
  }

  if (input === "~") {
    return os.homedir();
  }

  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(os.homedir(), input.slice(2));
  }

  return input;
}

function commandExists(command: string): boolean {
  const result = spawnSync("which", [command], { stdio: "ignore" });
  return result.status === 0;
}
