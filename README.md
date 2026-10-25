# FakeVoice

A Vencord userplugin that adds **Fake Deafen** and **Fake Mute** to the right-click menu of the normal deafen button.

Others see you as deafened or muted while you can still hear everyone (and, with Fake Mute, still talk). No extra button clutters your voice panel: everything lives in the deafen button you already use.

[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![Vencord userplugin](https://img.shields.io/badge/Vencord-userplugin-5865F2.svg)](https://docs.vencord.dev/installing/custom-plugins/)

## Features

- **Fake Deafen**: others see you deafened (and muted), you still hear everything
- **Fake Mute**: others see you muted, your microphone stays live
- Both toggles sit in the **right-click menu of the normal deafen button**, above Discord's usual audio-output options
- **Left-click** on the deafen button stays completely normal (deafen / undeafen)
- Re-sends your voice state and verifies it arrived, so the fake state applies reliably and clears cleanly when you turn it off

## How it works

Discord reports your mute/deafen state to the server in a `VOICE_STATE_UPDATE` gateway message. This plugin rewrites the `self_mute` / `self_deaf` flags in that message, so the server (and everyone else) sees the faked state while your local audio keeps working.

## Usage

1. Join a voice channel.
2. **Right-click** the deafen button (headphones icon, bottom-left).
3. Tick **Fake Deafen** or **Fake Mute** in the "Fake Voice" section at the top.

> [!TIP]
> When Fake Deafen is on, mute your microphone normally as well. Otherwise others see the green speaking ring when you talk and may still hear you.

> [!NOTE]
> The menu closes after a click (standard Discord menu behaviour). Right-click again to toggle the other option.

## Installation

This is a Vencord **userplugin**, so it is not in the official plugin list. You need a [source build of Vencord](https://docs.vencord.dev/installing/).

1. Clone this repo into your Vencord userplugins folder:
   ```sh
   cd Vencord/src/userplugins
   git clone https://github.com/MagicKey08/FakeVoice
   ```
2. Build Vencord from the `Vencord` folder:
   ```sh
   pnpm build
   ```
3. Close Discord fully, then inject:
   ```sh
   pnpm inject
   ```
4. Start Discord and enable **FakeVoice** under Settings -> Vencord -> Plugins.

## Compatibility

Tested on Windows with a Vencord source build in the Discord desktop app (stable), October 2026.

Discord updates can break plugin patches at any time. If something stops working, please [open an issue](https://github.com/MagicKey08/FakeVoice/issues/new/choose) and include your Vencord version and Discord build (Settings -> scroll to the bottom of the left sidebar).

## Credits

The idea of a fake mute/deafen toggle goes back to the (now broken) [FakeVoiceOptions](https://github.com/eightcon/FakeVoiceOptions) plugin. This is an independent rewrite for current Vencord, with the control moved into the deafen button's own menu.

## Disclaimer

For educational purposes. Using Vencord and third-party modifications is against Discord's Terms of Service. Use at your own risk.

## License

[GPL-3.0-or-later](LICENSE), the same license as Vencord.

## Author

Made by [MagicKey08](https://github.com/MagicKey08).
