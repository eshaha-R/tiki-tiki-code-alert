# Tiki Tiki Code Alert

[![CI](https://github.com/eshaha-R/tiki-tiki-code-alert/actions/workflows/ci.yml/badge.svg)](https://github.com/eshaha-R/tiki-tiki-code-alert/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/eshaha-R/tiki-tiki-code-alert?style=social)](https://github.com/eshaha-R/tiki-tiki-code-alert/stargazers)

Tiki Tiki Code Alert plays a rising tiki-style buildup when VS Code sees active error diagnostics and you keep typing anyway.

It is a tiny, local-first extension for that exact moment when the editor is quietly telling you "something is broken" and your hands keep going.

## What It Does

- Watches diagnostics in the active file.
- Waits until you continue editing while errors are present.
- Plays a short buildup sound after a configurable delay.
- Stops when the active file's errors are fixed.
- Lets you point to your own licensed sound file.

The extension does not ship copyrighted meme audio. The default sound is a generated WAV inspired by quick "tiki" percussion. If you own or have permission to use a specific viral sound, set it as a custom local file.

## Install From VSIX

Download the latest `.vsix` from the GitHub release, then run:

```bash
code --install-extension tiki-tiki-code-alert-0.1.1.vsix
```

Or install it from VS Code:

1. Open Extensions.
2. Choose "Install from VSIX..."
3. Pick the downloaded file.

## Commands

- `Tiki Tiki Code Alert: Toggle`
- `Tiki Tiki Code Alert: Test Sound`
- `Tiki Tiki Code Alert: Select Custom Sound`
- `Tiki Tiki Code Alert: Silence`

## Settings

```json
{
  "tikiTikiCodeAlert.enabled": true,
  "tikiTikiCodeAlert.delayMs": 1500,
  "tikiTikiCodeAlert.cooldownMs": 3500,
  "tikiTikiCodeAlert.triggerMode": "errors",
  "tikiTikiCodeAlert.customSoundFile": "",
  "tikiTikiCodeAlert.statusBarEnabled": true
}
```

`triggerMode` can be:

- `errors`: trigger on any active error diagnostic in the current file.
- `syntaxLike`: trigger only when a diagnostic looks like a syntax or parser error.

## Add Your Own Tiki Sound

Use a sound file that you own or have permission to use. Do not extract copyrighted audio from YouTube, TikTok, Instagram, or another creator's video unless you have the rights.

The easiest way:

1. Open the Command Palette.
2. Run `Tiki Tiki Code Alert: Select Custom Sound`.
3. Choose a local audio file.
4. Click `Test Sound`.

You can also set the path manually:

```json
{
  "tikiTikiCodeAlert.customSoundFile": "/Users/you/Sounds/tiki-buildup.wav"
}
```

WAV files are the most reliable across platforms. macOS can also play formats supported by `afplay`.

## Why Diagnostics Instead Of Cloud AI

Syntax errors are already detected by VS Code language services. Using diagnostics keeps the extension instant, private, and free. No code leaves your machine.

## Development

```bash
npm install
npm run compile
npm test
npm run package
```

Press `F5` in VS Code to launch an Extension Development Host.

## Publish To VS Code Marketplace

Marketplace publishing requires a Visual Studio Marketplace publisher and a token with Marketplace Manage permissions.

1. Create or open your publisher at <https://marketplace.visualstudio.com/manage/publishers/>.
2. Create an Azure DevOps token with Marketplace `Manage` permission.
3. Add it to this GitHub repo as an Actions secret named `VSCE_PAT`.
4. Run the `Publish to VS Code Marketplace` workflow from the GitHub Actions tab.

## Star Bait, But Honest

If this saves your compile from becoming performance art, star the repo and share it with a friend who ignores squiggles.

## License

MIT
