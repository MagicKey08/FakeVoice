/*
 * FakeVoice, a Vencord userplugin
 * Shows others that you are muted or deafened while you keep hearing
 * (and, with Fake Mute, keep talking). Controlled from the right-click
 * menu of the normal deafen button.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStore } from "@webpack";
import { Menu, MediaEngineStore, React, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

const logger = new Logger("FakeVoice");
const VOICE_STATE_UPDATE_OP = 4;

const VoiceActions = findByPropsLazy("toggleSelfMute", "toggleSelfDeaf");

export const settings = definePluginSettings({
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        description: "Fake Deafen: others see you deafened (and muted), but you still hear everything.",
        default: false,
        onChange: () => resendVoiceState()
    },
    fakeMute: {
        type: OptionType.BOOLEAN,
        description: "Fake Mute: others see you muted, but your microphone stays live.",
        default: false,
        onChange: () => resendVoiceState()
    }
});

/* ---------------- Core logic ---------------- */

function applyOverrides(payload: any) {
    if (!payload || typeof payload !== "object" || !("self_deaf" in payload || "self_mute" in payload)) return payload;
    const { fakeDeafen, fakeMute } = settings.store;
    if (!fakeDeafen && !fakeMute) return payload;

    const copy = { ...payload };
    if (fakeDeafen) {
        copy.self_deaf = true;
        copy.self_mute = true;
    }
    if (fakeMute) copy.self_mute = true;
    return copy;
}

let socket: any = null;
let originalSend: ((...args: any[]) => any) | null = null;
let originalVoiceStateUpdate: ((...args: any[]) => any) | null = null;
let lastVoiceStateArgs: any[] | null = null;
let lastRawPayload: any = null;

function getSocket() {
    try {
        return findStore("GatewayConnectionStore")?.getSocket?.() ?? null;
    } catch {
        return null;
    }
}

function hookSocket() {
    const s = getSocket();
    if (!s || typeof s.send !== "function") {
        logger.warn("Gateway socket not found, relying on code patch only");
        return false;
    }
    if (socket === s && originalSend) return true;
    unhookSocket();

    socket = s;
    originalSend = s.send;
    s.send = function (op: number, payload: any, ...rest: any[]) {
        if (op === VOICE_STATE_UPDATE_OP && payload && typeof payload === "object") {
            lastRawPayload = payload;
            payload = applyOverrides(payload);
        }
        return originalSend!.call(this, op, payload, ...rest);
    };

    if (typeof s.voiceStateUpdate === "function") {
        originalVoiceStateUpdate = s.voiceStateUpdate;
        s.voiceStateUpdate = function (...args: any[]) {
            lastVoiceStateArgs = args;
            return originalVoiceStateUpdate!.apply(this, args);
        };
    }
    return true;
}

function unhookSocket() {
    if (socket) {
        if (originalSend) socket.send = originalSend;
        if (originalVoiceStateUpdate) socket.voiceStateUpdate = originalVoiceStateUpdate;
    }
    socket = null;
    originalSend = null;
    originalVoiceStateUpdate = null;
}

function expectedServerState() {
    const { fakeDeafen, fakeMute } = settings.store;
    return {
        mute: fakeDeafen || fakeMute || MediaEngineStore.isSelfMute(),
        deaf: fakeDeafen || MediaEngineStore.isSelfDeaf()
    };
}

function serverMatches() {
    const me = UserStore.getCurrentUser();
    const vs: any = me && VoiceStateStore.getVoiceStateForUser(me.id);
    if (!vs?.channelId) return true;
    const want = expectedServerState();
    return !!vs.selfMute === want.mute && !!vs.selfDeaf === want.deaf;
}

function sendOnce(attempt: number) {
    hookSocket();
    try {
        if (attempt < 2 && socket && lastRawPayload && originalSend) {
            // send a copy, the wrapper applies the current overrides itself
            socket.send(VOICE_STATE_UPDATE_OP, { ...lastRawPayload });
            return;
        }
        if (attempt < 2 && socket && lastVoiceStateArgs && originalVoiceStateUpdate) {
            socket.voiceStateUpdate(...lastVoiceStateArgs);
            return;
        }
    } catch (e) {
        logger.error("Resending voice state failed", e);
    }
    // fallback: toggle twice quickly so Discord re-sends the state itself
    try {
        VoiceActions.toggleSelfMute();
        setTimeout(() => VoiceActions.toggleSelfMute(), 200);
    } catch (e) {
        logger.error("Fallback resend failed", e);
    }
}

let resendTimer: any = null;
let verifyTimer: any = null;

/** Re-sends the current voice state to Discord and then checks that it arrived. */
function resendVoiceState(attempt = 0) {
    clearTimeout(resendTimer);
    clearTimeout(verifyTimer);
    if (!SelectedChannelStore.getVoiceChannelId()) return;

    resendTimer = setTimeout(() => {
        sendOnce(attempt);
        verifyTimer = setTimeout(() => {
            if (!serverMatches() && attempt < 3) {
                logger.warn("Voice state not applied yet, retrying", attempt + 1);
                resendVoiceState(attempt + 1);
            }
        }, 1800);
    }, attempt === 0 ? 150 : 400);
}

function DeafenMenuInner({ vcOrig, vcProps }: { vcOrig: any; vcProps: any; }) {
    const { fakeDeafen, fakeMute } = settings.use(["fakeDeafen", "fakeMute"]);
    return (
        <>
            <Menu.Menu navId="vc-fakevoice-deafen" onClose={vcProps.onClose}>
                <Menu.MenuGroup label="Fake Voice">
                    <Menu.MenuCheckboxItem
                        id="vc-fake-deafen"
                        label="Fake Deafen"
                        checked={fakeDeafen}
                        action={() => { settings.store.fakeDeafen = !fakeDeafen; }}
                    />
                    <Menu.MenuCheckboxItem
                        id="vc-fake-mute"
                        label="Fake Mute"
                        checked={fakeMute}
                        action={() => { settings.store.fakeMute = !fakeMute; }}
                    />
                </Menu.MenuGroup>
            </Menu.Menu>
            {React.createElement(vcOrig, vcProps)}
        </>
    );
}

const DeafenMenu = ErrorBoundary.wrap(DeafenMenuInner, {
    fallback: ({ wrappedProps }: any) => React.createElement(wrappedProps.vcOrig, wrappedProps.vcProps)
});

export default definePlugin({
    name: "FakeVoice",
    description: "Fake Mute and Fake Deafen in the right-click menu of the normal deafen button. Others see you muted or deafened while you keep hearing and talking.",
    authors: [{ name: "MagicKey08", id: 1103681094089449565n }],
    tags: ["Voice"],
    settings,

    patches: [
        // rewrite Discord's voiceStateUpdate so the faked state is sent
        {
            find: "}voiceStateUpdate(",
            noWarn: true,
            replacement: {
                match: /self_mute:([^,]+),self_deaf:([^,]+)/,
                replace: "self_mute:$self.overrideMute($1),self_deaf:$self.overrideDeaf($2)"
            }
        },
        // right-click popout of the deafen button: our toggles go above Discord's audio device menu
        {
            find: "renderOutputDevices:!0",
            replacement: {
                match: /\(0,(\i)\.jsx\)\((\i\.\i),(\{onInteraction:[^{}]*?renderOutputDevices:!0[^{}]*?\})\)/,
                replace: "(0,$1.jsx)($self.DeafenMenu,{vcOrig:$2,vcProps:$3})"
            }
        }
    ],

    DeafenMenu,

    overrideMute(real: boolean) {
        return settings.store.fakeDeafen || settings.store.fakeMute ? true : real;
    },
    overrideDeaf(real: boolean) {
        return settings.store.fakeDeafen ? true : real;
    },

    flux: {
        CONNECTION_OPEN() {
            hookSocket();
        }
    },

    start() {
        hookSocket();
    },

    stop() {
        const wasActive = settings.store.fakeDeafen || settings.store.fakeMute;
        settings.store.fakeDeafen = false;
        settings.store.fakeMute = false;
        clearTimeout(resendTimer);
        clearTimeout(verifyTimer);
        if (wasActive) sendOnce(0);
        unhookSocket();
        lastRawPayload = null;
        lastVoiceStateArgs = null;
    }
});
