import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { RGBA, TextAttributes, type OptimizedBuffer } from "@opentui/core";
import { profile } from "@/lib/profile";
import { getProjects, projects, type Project } from "@/lib/projects";
import { parseHonours } from "@/lib/project-labels";
import { COPY_GAP, COPY_PAD, TEX_CH, TEX_HEX, fillTones, texturePhase } from "@/lib/texture";
import { ask, type ChatMessage } from "@/lib/ai";
import { EXTERNAL_LINK_ARROW } from "@/lib/symbols";
import { techTag } from "@/lib/tech";
import { BANNER_SHADE, banner, bannerRows } from "@/lib/banner";
import type { LinkedInSnapshot } from "@/lib/linkedin";
import type { VisitInfo } from "@/lib/visits";
import { capture } from "@/lib/analytics";
import { getSpotify, type SpotifyState } from "@/lib/spotify";
import { getPreviewUrl } from "@/lib/preview";
import { autoName, deleteSession, listSessions, loadSession, saveSession, type SavedSession } from "@/lib/sessions";
import { liveCount } from "@/lib/presence";
import { getGitHub, type GitHubPulse } from "@/lib/github";
import { recordQuestion } from "@/lib/questions";
import {
  PondSim,
  PAL_HEX,
  POND_BG_HEX,
  WATER_CP,
  WATER_CREST_HEX,
  WATER_TROUGH_HEX,
  CP_FULL,
  CP_HALF,
  CP_EYE,
  C_EYE,
  waterBucket,
  MOVE_AMP,
  DOWN_AMP,
  SPLASH_CAP,
} from "@/lib/pond";
import { ACCENT, BARS, ERR, FAINT, HAIRLINE, INK, LIVE, MUTED, PANEL, SEL_BG, SEP, STAR, Stat, commas, compactNum, timeAgo, truncate } from "./ui";
import { NowPlaying, VolumeBar, type VolumeChannel } from "./music";

const MAX_CHAT_INPUT_CHARS = 2_000;
const MAX_CHAT_MESSAGES = 50;

type Screen = "home" | "projects" | "chat";

const NAV: { key: string; screen: Screen }[] = [
  { key: "h", screen: "home" },
  { key: "p", screen: "projects" },
  { key: "c", screen: "chat" },
];
const SCREENS: Screen[] = ["home", "projects", "chat"];
// About merged into home: the old key and command still land there
const NAV_ALIAS: Record<string, Screen> = { a: "home", about: "home" };

// grouped /help — rendered as a multi-line assistant message (hierarchy, not one line)
const HELP_TEXT = [
  "COMMANDS",
  "  /help              show this",
  "  /clear             wipe history",
  "  /save [name]       save chat (auto-named if blank)",
  "  /resume [name]     reopen a saved chat — no name opens a picker",
  "  /delete [name]     delete a saved chat — no name opens a picker",
  "  /exit              back to home",
  "NAVIGATE",
  "  /home /projects /chat   (or press h p c)",
  "SCROLL",
  "  PageUp / PageDown   ·   ↑ / ↓ when the input is empty",
].join("\n");
const PUBLIC_SSH_HELP_TEXT = [
  "COMMANDS",
  "  /help              show this",
  "  /clear             wipe history",
  "  /exit              back to home",
  "NAVIGATE",
  "  /home /projects /chat   (or press h p c)",
  "SCROLL",
  "  PageUp / PageDown   ·   ↑ / ↓ when the input is empty",
  "",
  "Saved chats are disabled on public SSH sessions.",
].join("\n");

function compactLanguage(value: string) {
  return value
    .replace(/\s+(native or bilingual|full professional|professional working|limited working|elementary)\s+proficiency.*$/i, "")
    .trim();
}

// tight dashed rules (no solid lines anywhere)
// wrapMode none + explicit height: a text that exactly fills the terminal width
// measures as 2 wrapped rows (opentui edge case), overflowing tight column layouts
function Rule({ w }: { w?: number }) {
  const { width } = useTerminalDimensions();
  return <text bg={PANEL} fg={HAIRLINE} wrapMode="none" style={{ height: 1 }}>{"-".repeat(Math.max(1, w ?? width))}</text>;
}
// one multi-line text node (not one per row) with pinned size — cheap and layout-stable
function VRule({ rows }: { rows: number }) {
  const n = Math.max(1, rows);
  return (
    <text bg={PANEL} fg={HAIRLINE} wrapMode="none" style={{ width: 1, height: n }}>
      {Array.from({ length: n }, () => "╎").join("\n")}
    </text>
  );
}


// The one link primitive. <a href> emits OSC 8 when the terminal supports it (clickable),
// otherwise renders as plain underlined accent text — never garbage.
function LinkLine({ label, href, text, bg, wrapMode }: { label: string; href: string; text: string; bg?: string; wrapMode?: "none" }) {
  return (
    <text bg={bg ?? PANEL} wrapMode={wrapMode}>
      <span fg={MUTED}>{label.padEnd(10)}</span>
      <a href={href} fg={ACCENT} attributes={TextAttributes.UNDERLINE}>
        {text}
      </a>
      <span fg={FAINT}> {EXTERNAL_LINK_ARROW}</span>
    </text>
  );
}

function ThinkingDots() {
  const frames = ["✶", "✳", "✻", "✽", "✻", "✳"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % frames.length), 120);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <text bg={PANEL}>
      <span fg={ACCENT}>{frames[i]} </span>
      <span fg={MUTED}>thinking…</span>
    </text>
  );
}

// Full-screen typed boot log. Used as the intro on connect (load-in) and on every screen
// change (load-out → swap → load-in). Lines type out, a bar fills, then onDone reveals.
const HOME = `/home/${profile.name.split(" ")[0].toLowerCase()}`;
const BOOT_LINES = [
  `$ ssh guest@${profile.site}`,
  "Authenticating guest ............ OK",
  `$ ./${profile.site} --boot`,
  `[ ok ] mount ${HOME}`,
  "[ ok ] load profile.json",
  `[ ok ] index projects (${projects.length})`,
  "[ ok ] load model weights",
  "[ ok ] connect spotify",
  "[ ok ] start ai-search daemon",
  "[ ok ] render tui",
  "ready.",
  "",
  `welcome — ${profile.name.toLowerCase()}`,
];

// a returning visitor (same browser session) gets two lines instead of the whole log
const QUICK_BOOT_LINES = [`$ ./${profile.site}`, "ready."];

function bootLinesFor(to: Screen): string[] {
  return [`$ cd ~/${to}`, `[ ok ] open ${to}`];
}

// shutdown log shown on quit before the connection closes
const SHUTDOWN_LINES = [
  "$ exit",
  "[ ok ] flush analytics",
  "[ ok ] stop ai-search daemon",
  "[ ok ] release koi pond",
  `[ ok ] unmount ${HOME}`,
  "connection closed.",
  `goodbye — ${profile.name.toLowerCase()}`,
];

function BootLine({ line }: { line: string }) {
  if (line.startsWith("[ ok ]")) {
    return (
      <text bg={PANEL}>
        <span fg={ACCENT}>[ ok ]</span>
        <span fg={MUTED}>{line.slice(6)}</span>
      </text>
    );
  }
  if (line.startsWith("$")) {
    return (
      <text bg={PANEL}>
        <span fg={ACCENT}>$</span>
        <span fg={INK}>{line.slice(1)}</span>
      </text>
    );
  }
  if (line === "ready." || line.startsWith("welcome") || line.startsWith("goodbye"))
    return <text bg={PANEL} fg={ACCENT}>{line}</text>;
  return <text bg={PANEL} fg={MUTED}>{line}</text>;
}

// `step` ms per typed line and `hold` ms on the finished log; a tap skips to the end (any key
// does too, in the App's keyboard handler)
function BootScreen({ lines, onDone, step = 80, hold = 300 }: { lines: string[]; onDone: () => void; step?: number; hold?: number }) {
  const [n, setN] = useState(0);
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    let i = 0;
    let done: ReturnType<typeof setTimeout> | undefined;
    const type = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= lines.length) {
        clearInterval(type);
        done = setTimeout(onDone, hold);
      }
    }, step);
    const cur = setInterval(() => setBlink((b) => !b), 380);
    return () => {
      clearInterval(type);
      clearInterval(cur);
      if (done) clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = lines.length;
  const filled = Math.round((n / steps) * 24);
  return (
    <box style={{ width: "100%", height: "100%", flexDirection: "column", paddingLeft: 2, paddingTop: 1 }} onMouseDown={onDone}>
      {lines.slice(0, n).map((l, i) => (
        <BootLine key={i} line={l} />
      ))}
      <text bg={PANEL}>
        <span fg={ACCENT}>{blink ? "▋" : " "}</span>
      </text>
      <box style={{ flexGrow: 1 }} />
      <text bg={PANEL}>
        <span fg={ACCENT}>{"▰".repeat(filled)}</span>
        <span fg={FAINT}>{"▱".repeat(Math.max(0, 24 - filled))}</span>
        <span fg={MUTED}>{`  ${Math.round((n / steps) * 100)}%`}</span>
      </text>
    </box>
  );
}

export default function App({
  linkedIn,
  visit,
  distinctId,
  onExit,
  volume,
  pond = true,
  allowSavedSessions = true,
  quickBoot = false,
  reducedMotion = false,
  initialScreen,
  onScreen,
  onSwitch,
}: {
  linkedIn: LinkedInSnapshot;
  visit: VisitInfo;
  distinctId: string;
  onExit: () => void;
  volume?: VolumeChannel;
  // web sessions render the pond client-side on a canvas (web/pond.ts); ssh/local keep it here
  pond?: boolean;
  // Public SSH has no visitor identity, so persisted transcripts would be shared globally.
  allowSavedSessions?: boolean;
  // web: the full boot log once per browser session, then the two-line one
  quickBoot?: boolean;
  // prefers-reduced-motion: no boot log and no screen-change log
  reducedMotion?: boolean;
  // web: the screen named in the URL (#projects), and a hook to keep the URL in step
  initialScreen?: string;
  onScreen?: (screen: string) => void;
  // web: open the phone edition (footer tab and the m key); absent over SSH
  onSwitch?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>(() => SCREENS.find((s) => s === initialScreen) ?? "home");
  const [booting, setBooting] = useState(!reducedMotion); // full-screen boot log on first mount
  const [transition, setTransition] = useState<Screen | null>(null);
  const [quitting, setQuitting] = useState(false); // boot-down log before the connection closes
  const [selected, setSelected] = useState(0);
  const projectList = useProjects();
  const go = useCallback(
    (target: Screen) => {
      capture(distinctId, "nav", { screen: target });
      if (reducedMotion) setScreen(target);
      else setTransition(target);
    },
    [distinctId, reducedMotion],
  );
  useEffect(() => onScreen?.(screen), [screen, onScreen]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [scroll, setScroll] = useState(0); // chat history scrollback (0 = pinned to latest)
  const [picker, setPicker] = useState<{ items: SavedSession[]; index: number; mode: "resume" | "delete" } | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const inputRef = useRef(""); // mirror of `input` for the keyboard handler (avoids stale closure)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatActive = screen === "chat";
  const quit = useCallback(() => setQuitting(true), []);

  const loadInto = useCallback((msgs: ChatMessage[]) => {
    messagesRef.current = msgs;
    setMessages(msgs);
    setScroll(0);
    setPicker(null);
  }, []);

  const handleInput = useCallback((v: string) => {
    const bounded = v.slice(0, MAX_CHAT_INPUT_CHARS);
    inputRef.current = bounded;
    setInput(bounded);
  }, []);
  const resetInput = useCallback(() => {
    inputRef.current = "";
    setInput("");
    setInputKey((k) => k + 1);
  }, []);

  // full-screen koi pond shared state (rendered behind all content)
  const { width: termW, height: termH } = useTerminalDimensions();
  // narrow viewport (phones / small terminals): stack columns + compact footer
  const narrow = termW < 64;
  const pondMouse = useRef<{ x: number; y: number } | null>(null);
  const pondSplash = useRef<{ x: number; y: number; amp: number }[]>([]);
  const pondMoveN = useRef(0);
  const pondCells = useRef(new Uint16Array(0)); // what KoiPond drew per cell, for CopyClearance

  // hide the terminal cursor (opentui Inputs draw their own caret)
  const renderer = useRenderer();
  useEffect(() => {
    renderer.setCursorPosition(0, 0, false);
  }, [renderer, screen, booting, transition]);

  const pushAssistant = useCallback((text: string) => {
    const withNote = [...messagesRef.current, { role: "assistant" as const, content: text }];
    messagesRef.current = withNote;
    setMessages(withNote);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || sending) return;
      // slash commands (claude-code-style) — handled locally, not sent to AI
      if (content.startsWith("/")) {
        resetInput();
        setScroll(0);
        const parts = content.slice(1).split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg = parts.slice(1).join(" ").trim();
        // /home /projects /chat (and single-char aliases h p c; /about and a go home)
        const navTarget =
          (SCREENS.find((s) => s === cmd) as Screen | undefined) ?? NAV.find((n) => n.key === cmd)?.screen ?? NAV_ALIAS[cmd];
        if (navTarget) {
          if (navTarget !== "chat") go(navTarget);
          return;
        }
        if (cmd === "clear") {
          messagesRef.current = [];
          setMessages([]);
        } else if (cmd === "exit" || cmd === "quit") {
          go("home");
        } else if (!allowSavedSessions && ["save", "resume", "delete", "del", "rm"].includes(cmd)) {
          pushAssistant("saved chats are disabled on public SSH sessions.");
        } else if (cmd === "save") {
          if (messagesRef.current.length === 0) {
            pushAssistant("nothing to save yet.");
          } else {
            const s = saveSession(arg || autoName(messagesRef.current), messagesRef.current);
            pushAssistant(`saved as "${s.name}" (${s.count} messages). /resume to bring it back.`);
          }
        } else if (cmd === "resume") {
          if (arg) {
            const msgs = loadSession(arg);
            if (msgs) loadInto(msgs);
            else pushAssistant(`no saved chat "${arg}" — /resume with no name to pick one.`);
          } else {
            const items = listSessions();
            if (items.length === 0) pushAssistant("no saved chats yet — /save first.");
            else setPicker({ items, index: 0, mode: "resume" });
          }
        } else if (cmd === "delete" || cmd === "del" || cmd === "rm") {
          if (arg) {
            pushAssistant(deleteSession(arg) ? `deleted "${arg}".` : `no saved chat "${arg}".`);
          } else {
            const items = listSessions();
            if (items.length === 0) pushAssistant("no saved chats to delete.");
            else setPicker({ items, index: 0, mode: "delete" });
          }
        } else if (cmd === "help") {
          pushAssistant(allowSavedSessions ? HELP_TEXT : PUBLIC_SSH_HELP_TEXT);
        } else {
          pushAssistant(`unknown command: /${cmd} — try /help`);
        }
        return;
      }
      recordQuestion(content);
      const next = [...messagesRef.current, { role: "user" as const, content }].slice(-MAX_CHAT_MESSAGES);
      messagesRef.current = next;
      setMessages(next);
      setScroll(0);
      resetInput();
      setSending(true);
      const result = await ask(next);
      const reply: ChatMessage = { role: "assistant", content: result.answer ?? result.error ?? "No response." };
      const withReply = [...messagesRef.current, reply].slice(-MAX_CHAT_MESSAGES);
      messagesRef.current = withReply;
      setMessages(withReply);
      setScroll(0);
      setSending(false);
    },
    [allowSavedSessions, sending, resetInput, go, pushAssistant, loadInto],
  );

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") return quit();
    // any key skips the boot log or a screen change (and is not also taken as a command)
    if (booting) return setBooting(false);
    if (transition) {
      setScreen(transition);
      setTransition(null);
      return;
    }
    // resume picker overlay takes all keys while open
    if (picker) {
      if (key.name === "up" || key.name === "k")
        return setPicker((p) => (p ? { ...p, index: Math.max(0, p.index - 1) } : p));
      if (key.name === "down" || key.name === "j")
        return setPicker((p) => (p ? { ...p, index: Math.min(p.items.length - 1, p.index + 1) } : p));
      if (key.name === "return" || key.name === "enter") {
        const sel = picker.items[picker.index];
        if (sel && picker.mode === "delete") {
          deleteSession(sel.slug);
          const items = listSessions();
          if (items.length === 0) setPicker(null);
          else setPicker((p) => (p ? { ...p, items, index: Math.min(p.index, items.length - 1) } : p));
          return;
        }
        const msgs = sel ? loadSession(sel.slug) : null;
        if (msgs) loadInto(msgs);
        else setPicker(null);
        return;
      }
      if (key.name === "escape") return setPicker(null);
      return;
    }
    // web only: chat input can be blurred by clicking away — keys then act as plain
    // hotkeys (instant nav), not typing. The TUI never blurs, so inputFocused is absent.
    if (chatActive && ((key as { inputFocused?: boolean }).inputFocused ?? true)) {
      if (key.name === "escape") {
        if (navTimer.current) clearTimeout(navTimer.current);
        navTimer.current = null;
        go("home");
        return;
      }
      // scroll chat history: PageUp/PageDown, or ↑/↓ when the input is empty
      if (key.name === "pageup") return setScroll((s) => s + 3);
      if (key.name === "pagedown") return setScroll((s) => Math.max(0, s - 3));
      if (inputRef.current === "" && key.name === "up") return setScroll((s) => s + 1);
      if (inputRef.current === "" && key.name === "down") return setScroll((s) => Math.max(0, s - 1));
      // any keystroke cancels a pending first-letter nav (means the user is actually typing)
      if (navTimer.current) {
        clearTimeout(navTimer.current);
        navTimer.current = null;
      }
      // first-letter nav: empty input + a nav letter held >250ms with no more typing → navigate
      if (inputRef.current === "" && typeof key.name === "string" && key.name.length === 1) {
        const nav = NAV.find((n) => n.key === key.name);
        if (nav && nav.screen !== "chat") {
          const target = nav.screen;
          const letter = key.name;
          navTimer.current = setTimeout(() => {
            navTimer.current = null;
            if (inputRef.current === letter) {
              resetInput();
              go(target);
            }
          }, 250);
        }
      }
      return;
    }
    if (key.name === "q") return quit();
    if (key.name === "m" && onSwitch) return onSwitch();
    // home ↑/↓ belong to the volume bar, which handles them itself (every surface)
    // ←/→ cycle screens — except where the arrows already mean something: chat keeps them
    // for the input caret (handled above), home's music browser owns them on every surface
    if (screen !== "home" && (key.name === "left" || key.name === "right")) {
      const i = SCREENS.indexOf(screen);
      go(SCREENS[(i + (key.name === "right" ? 1 : -1) + SCREENS.length) % SCREENS.length]);
      return;
    }
    if (screen === "projects") {
      if (key.name === "up" || key.name === "k") {
        setSelected((s) => (s - 1 + projectList.length) % projectList.length);
        return;
      }
      if (key.name === "down" || key.name === "j") {
        setSelected((s) => (s + 1) % projectList.length);
        return;
      }
    }
    const target = NAV.find((n) => n.key === key.name)?.screen ?? NAV_ALIAS[key.name];
    if (target && target !== screen) go(target);
  });

  if (quitting) {
    return <BootScreen key="bye" lines={SHUTDOWN_LINES} onDone={onExit} />;
  }
  if (booting) {
    return <BootScreen key="boot" lines={quickBoot ? QUICK_BOOT_LINES : BOOT_LINES} onDone={() => setBooting(false)} />;
  }
  // NOTE: the transition BootScreen is an opaque OVERLAY, not an early return — unmounting
  // and remounting the main tree makes opentui mis-measure remounted text rows (the header
  // row collapses to zero height and every screen shifts up one row until a resize).

  return (
    <box
      style={{ width: "100%", height: "100%" }}
      onMouseMove={(e: { x: number; y: number }) => {
        pondMouse.current = { x: e.x, y: e.y };
        // cap the queue so a fast cursor can't stockpile splash energy between wave ticks
        if (pondMoveN.current++ % 2 === 0 && pondSplash.current.length < SPLASH_CAP) pondSplash.current.push({ x: e.x, y: e.y, amp: MOVE_AMP });
      }}
      onMouseDown={(e: { x: number; y: number }) => {
        if (pondSplash.current.length < SPLASH_CAP) pondSplash.current.push({ x: e.x, y: e.y, amp: DOWN_AMP });
      }}
      onMouseOut={() => {
        pondMouse.current = null;
      }}
    >
      {/* smaller koi on a phone so they don't bleed through the sparse, narrow content */}
      {/* ponytail: when pond=false the root mouse handlers above still fill these refs; harmless, capped at 64 */}
      {pond && <KoiPond width={termW} height={termH} scale={narrow ? 0.5 : 1} mouseRef={pondMouse} splashRef={pondSplash} cellsRef={pondCells} />}
      <box style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", flexDirection: "column", zIndex: 1 }}>
        <Header screen={screen} visits={visit.count} />
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          {screen === "home" && <Home linkedIn={linkedIn} list={projectList} volume={volume} />}
          {screen === "projects" && <Projects list={projectList} selected={selected} onSelect={setSelected} />}
          {screen === "chat" && (
            <Chat
              messages={messages}
              sending={sending}
              input={input}
              inputKey={inputKey}
              scroll={scroll}
              inputActive={!picker}
              onInput={handleInput}
              onSubmit={send}
            />
          )}
        </box>
        <Footer screen={screen} chatActive={chatActive} onNav={go} onSwitch={onSwitch} />
      </box>
      {/* the pond paints under every cell; this pass keeps it out of each line of copy */}
      {pond && <CopyClearance cellsRef={pondCells} width={termW} height={termH} />}
      {picker && (
        <ResumePicker items={picker.items} index={picker.index} mode={picker.mode} width={termW} height={termH} />
      )}
      {transition && (
        <box style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", zIndex: 50, backgroundColor: POND_BG_HEX }}>
          <BootScreen
            key={transition}
            lines={bootLinesFor(transition)}
            step={40}
            hold={120}
            onDone={() => {
              setScreen(transition);
              setTransition(null);
            }}
          />
        </box>
      )}
    </box>
  );
}

function Header({ screen, visits }: { screen: Screen; visits: number }) {
  // the visitor count lives up here now that home is the profile; phones keep just the path
  const wide = useTerminalDimensions().width >= 64;
  return (
    // flexShrink 0: if a screen's body ever overflows again, crush the body, never the header
    <box style={{ flexDirection: "column", flexShrink: 0 }}>
      <box style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 2, paddingRight: 2, paddingTop: 1 }}>
        <text bg={PANEL}>
          <strong fg={INK}>{profile.site}</strong>
        </text>
        <box style={{ flexDirection: "row" }}>
          {wide && <VisitorHead total={visits} />}
          <text bg={PANEL}>
            <span fg={FAINT}>{wide ? "    ~/" : "~/"}</span>
            <span fg={ACCENT}>{screen}</span>
          </text>
        </box>
      </box>
      <Rule />
    </box>
  );
}

// one footer nav item — a tappable box (touch nav on mobile) that also shows the key hint
function NavTab({ item, active, onNav }: { item: { key: string; screen: Screen }; active: boolean; onNav: (s: Screen) => void }) {
  return (
    <box
      style={{ paddingRight: 2 }}
      onMouseDown={() => {
        if (!active) onNav(item.screen);
      }}
    >
      <text bg={PANEL}>
        <span fg={ACCENT}>{item.key}</span>
        <span fg={active ? INK : MUTED}>{` ${item.screen}`}</span>
      </text>
    </box>
  );
}

function Footer({
  screen,
  chatActive,
  onNav,
  onSwitch,
}: {
  screen: Screen;
  chatActive: boolean;
  onNav: (s: Screen) => void;
  onSwitch?: () => void;
}) {
  // nav tabs (~30, +9 with the phone tab) + the longest hint (34) + padding (4): below that the
  // hint wraps onto the tabs
  const showHint = useTerminalDimensions().width >= (onSwitch ? 80 : 70);
  const hint = chatActive
    ? "Enter send · Esc back"
    : screen === "projects"
      ? "↑↓ / j k move · ← → nav · q quit"
      : screen === "home"
        ? "← → tracks · ↑↓ vol · q quit"
        : "← → nav · q quit";
  return (
    <box style={{ flexDirection: "column", paddingBottom: 1 }}>
      <Rule />
      <box style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 2, paddingRight: 2 }}>
        <box style={{ flexDirection: "row" }}>
          {NAV.map((n) => (
            <NavTab key={n.key} item={n} active={n.screen === screen} onNav={onNav} />
          ))}
          {onSwitch && (
            <box style={{ paddingRight: 2 }} onMouseDown={onSwitch}>
              <text bg={PANEL}>
                <span fg={ACCENT}>m</span>
                <span fg={MUTED}>{" phone"}</span>
              </text>
            </box>
          )}
        </box>
        {showHint && <text bg={PANEL} fg={MUTED}>{hint}</text>}
      </box>
    </box>
  );
}

// The pond simulation lives in @/lib/pond (shared with the browser canvas renderer in
// web/pond.ts). Server-side it paints straight into the renderer's cell buffers (raw
// typed-array views over native memory — zero FFI, zero React reconciliation per frame).
// All colors are precomputed once as the 4×u16 RGBA quads the native buffer stores.
const u16 = (hex: string) => RGBA.fromHex(hex).buffer;
const WATER_CREST = WATER_CREST_HEX.map(u16);
const WATER_TROUGH = WATER_TROUGH_HEX.map(u16);
const POND_BG = u16(POND_BG_HEX); // matches the terminal bg so the pond stays seamless
const PAL_U16: Uint16Array[] = [new Uint16Array(4), ...PAL_HEX.slice(1).map(u16)];
// the water texture (@/lib/texture): one glyph + hiring's gray per tone; hiring indexes its
// shades by light level, which is 3 - tone
const TEX_CP = TEX_CH.map((c) => c.codePointAt(0) ?? 32);
const TEX_U16 = TEX_CH.map((_, tone) => u16(TEX_HEX[3 - tone]));
// a terminal row is ~2.2 columns tall; the texture samples in column widths so its cells
// come out round on screen
const CELL_ROW_U = 2.2;
// header (pad + title + rule) and footer (rule + nav + pad) rows stay texture-free
const CHROME_ROWS = 3;

// Full-screen koi pond behind all content; koi swim in from the edges, flee the cursor;
// cursor/koi leave wave-sim ripples. Mouse + splashes are fed in from the App root.
// Rendered as a `live` box that paints directly into the renderer's cell buffers each
// frame (renderAfter) — no per-frame React state/reconciliation, so cost is flat no
// matter how choppy the water or how much the koi overlap.
export function KoiPond({
  width,
  height,
  scale = 1,
  mouseRef,
  splashRef,
  cellsRef,
}: {
  width: number;
  height: number;
  scale?: number;
  mouseRef: { current: { x: number; y: number } | null };
  splashRef: { current: { x: number; y: number; amp: number }[] };
  cellsRef: { current: Uint16Array };
}) {
  const W = Math.max(10, width);
  const H = Math.max(6, height);
  // shared sim (same code drives the browser canvas); recreated on resize — koi
  // re-enter from the edges, which reads as the intentional swim-in intro
  const simRef = useRef<PondSim | null>(null);
  if (!simRef.current || simRef.current.W !== W || simRef.current.H !== H || simRef.current.scale !== scale) {
    simRef.current = new PondSim(W, H, scale);
  }
  const tonesRef = useRef(new Uint8Array(0));
  const texClock = useRef({ now: 0, drawn: 0 });

  const draw = useCallback(
    (buffer: OptimizedBuffer, deltaMs: number) => {
      const sim = simRef.current!;
      // feed inputs from the App-root refs, then advance the shared simulation
      sim.mouse = mouseRef.current;
      const q = splashRef.current;
      for (let i = 0; i < q.length; i += 1) sim.splash(q[i].x, q[i].y, q[i].amp);
      q.length = 0;
      sim.step(deltaMs);

      // composite water + koi straight into the renderer's raw cell buffers: one glyph
      // per cell, koi shaded by coverage of its two half-block pixels
      const buf = sim.px;
      const field = sim.field;
      const PW = sim.PW;
      const raw = buffer.buffers;
      const bw = buffer.width;
      const cw = Math.min(W, bw);
      const chRows = Math.min(H, buffer.height);
      const chB = raw.char;
      const fgB = raw.fg;
      const bgB = raw.bg;
      const atB = raw.attributes;
      // the texture drifts slowly (a full turn per minute), so 10 refreshes a second are
      // indistinguishable from every frame at a tenth of the cost
      const resized = tonesRef.current.length !== W * H;
      if (resized) tonesRef.current = new Uint8Array(W * H);
      const tones = tonesRef.current;
      const clock = texClock.current;
      clock.now += deltaMs;
      if (resized || clock.now - clock.drawn >= 100) {
        fillTones(tones, W, H, CELL_ROW_U, texturePhase(clock.now, false));
        clock.drawn = clock.now;
      }
      // what the pond itself wrote per cell (glyph + colour, 4 u16 each), so CopyClearance
      // can tell pond cells from copy; every pond glyph is a BMP codepoint
      const drawn = cellsRef.current.length === bw * chRows * 4 ? cellsRef.current : (cellsRef.current = new Uint16Array(bw * chRows * 4));
      for (let y = 0; y < chRows; y += 1) {
        const rowOff = y * bw;
        const top0 = 2 * y * PW;
        const bot0 = top0 + PW;
        for (let x = 0; x < cw; x += 1) {
          const top = buf[top0 + x];
          const bot = buf[bot0 + x];
          let cp: number;
          let col: Uint16Array;
          if (top || bot) {
            const idx = top || bot;
            cp = idx === C_EYE ? CP_EYE : top && bot ? CP_FULL : CP_HALF;
            col = PAL_U16[idx];
          } else {
            const v = field[y * W + x];
            const bkt = waterBucket(v < 0 ? -v : v);
            cp = WATER_CP[bkt];
            col = v > 0 ? WATER_CREST[bkt] : WATER_TROUGH[bkt];
            // calm water shows the texture, except in the header and footer rows
            if (bkt === 0 && y >= CHROME_ROWS && y < chRows - CHROME_ROWS) {
              const tone = tones[y * W + x];
              cp = TEX_CP[tone];
              col = TEX_U16[tone];
            }
          }
          const ci = rowOff + x;
          const i4 = ci * 4;
          chB[ci] = cp;
          drawn[i4] = cp;
          drawn[i4 + 1] = col[0];
          drawn[i4 + 2] = col[1];
          drawn[i4 + 3] = col[2];
          fgB[i4] = col[0];
          fgB[i4 + 1] = col[1];
          fgB[i4 + 2] = col[2];
          fgB[i4 + 3] = col[3];
          bgB[i4] = POND_BG[0];
          bgB[i4 + 1] = POND_BG[1];
          bgB[i4 + 2] = POND_BG[2];
          bgB[i4 + 3] = POND_BG[3];
          atB[ci] = 0;
        }
      }
    },
    [W, H, mouseRef, splashRef, cellsRef],
  );

  // `live` keeps the renderer's frame loop running so renderAfter fires every frame
  return <box style={{ position: "absolute", left: 0, top: 0, width: W, height: H, zIndex: 0 }} live renderAfter={draw} />;
}

// Runs after the content has drawn, over the pond. Spaces inside a line of copy are
// transparent, so whatever the pond drew there - a texture strand, a ripple, a koi fin -
// would read as a typo between two words. As on the hiring page, each line of copy claims
// its whole run: pond glyphs in gaps of up to COPY_GAP cells between copy (the screen's left
// edge counts as copy, so the gutter before indented text stays clear too), and COPY_PAD
// cells either side of it, are blanked. Copy is any cell the pond did not draw (glyph and
// colour both differ from what KoiPond recorded), so a letter that happens to match a
// texture glyph is never mistaken for water.
export function CopyClearance({ cellsRef, width, height }: { cellsRef: { current: Uint16Array }; width: number; height: number }) {
  const draw = useCallback(
    (buffer: OptimizedBuffer) => {
      const { char: chB, fg: fgB } = buffer.buffers;
      const bw = buffer.width;
      const pond = cellsRef.current;
      const rows = Math.min(height, buffer.height, Math.floor(pond.length / (bw * 4)));
      const cols = Math.min(width, bw);
      const isPond = (ci: number) => {
        const i4 = ci * 4;
        return chB[ci] === pond[i4] && fgB[i4] === pond[i4 + 1] && fgB[i4 + 1] === pond[i4 + 2] && fgB[i4 + 2] === pond[i4 + 3];
      };
      const clear = (ci: number) => {
        if (chB[ci] !== 32 && isPond(ci)) chB[ci] = 32;
      };
      for (let y = 0; y < rows; y += 1) {
        const row = y * bw;
        let last = -1; // the left edge
        for (let x = 0; x < cols; x += 1) {
          const ci = row + x;
          if (chB[ci] === 32 || isPond(ci)) continue;
          if (x - last - 1 <= COPY_GAP) for (let k = last + 1; k < x; k += 1) clear(row + k);
          for (let k = Math.max(0, x - COPY_PAD); k <= Math.min(cols - 1, x + COPY_PAD); k += 1) clear(row + k);
          last = x;
        }
      }
    },
    [cellsRef, width, height],
  );
  return <box style={{ position: "absolute", left: 0, top: 0, width, height, zIndex: 2 }} live renderAfter={draw} />;
}

// total visitors + live online (polled) on one row
function VisitorHead({ total }: { total: number }) {
  const [n, setN] = useState(() => liveCount());
  useEffect(() => {
    const id = setInterval(() => setN(liveCount()), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <text bg={PANEL}>
      <strong fg={INK}>{`#${commas(total)}`}</strong>
      <span fg={MUTED}>{" visitors"}</span>
      <span fg={FAINT}>{SEP}</span>
      <span fg={LIVE}>{"◉ "}</span>
      <span fg={INK}>{n}</span>
      <span fg={MUTED}>{" online"}</span>
    </text>
  );
}

// the GITHUB stats row as plain text — its width anchors the music controls' alignment
// (the » lands on the ★ column)
// wide separator: the stats row spans the whole music-widget box (its width feeds
// controlsWidth), so « ▶ » and the ★ column frame the track list underneath
const GH_SEP = "    ·    ";
// fields a failed GitHub call left absent are skipped, never shown as 0
function ghParts(g: GitHubPulse): { text: string; fg: string; label?: string }[] {
  const parts: { text: string; fg: string; label?: string }[] = [];
  if (g.commits !== undefined) parts.push({ text: compactNum(g.commits), fg: INK, label: " commits" });
  if (g.contributions !== undefined) parts.push({ text: compactNum(g.contributions), fg: INK, label: " contributions" });
  if (g.stars !== undefined) parts.push({ text: `${compactNum(g.stars)}★`, fg: INK });
  return parts;
}
function ghStatsWidth(g: GitHubPulse): number {
  return ghParts(g)
    .map((p) => p.text + (p.label ?? ""))
    .join(GH_SEP).length;
}

// GitHub pulse: commits · contributions · stars + last push
function GitHubPulse({ g }: { g: GitHubPulse | null }) {
  return (
    <Stat label="GITHUB" meta={g?.lastPushAt ? `pushed ${timeAgo(g.lastPushAt)}` : undefined}>
      {g ? (
        <text bg={PANEL}>
          {ghParts(g).map((p, i) => (
            <Fragment key={p.text + (p.label ?? "")}>
              {i > 0 && <span fg={FAINT}>{GH_SEP}</span>}
              <span fg={p.fg}>{p.text}</span>
              {p.label && <span fg={MUTED}>{p.label}</span>}
            </Fragment>
          ))}
        </text>
      ) : (
        <text bg={PANEL} fg={FAINT}>
          …
        </text>
      )}
    </Stat>
  );
}

// arrow-key picker overlay for /resume and /delete
function ResumePicker({
  items,
  index,
  mode,
  width,
  height,
}: {
  items: SavedSession[];
  index: number;
  mode: "resume" | "delete";
  width: number;
  height: number;
}) {
  const w = Math.min(60, Math.max(28, width - 8));
  const rows = items.slice(0, 10);
  const accent = mode === "delete" ? ERR : ACCENT;
  return (
    <box
      style={{
        position: "absolute",
        left: Math.max(2, Math.floor((width - w) / 2)),
        top: Math.max(2, Math.floor(height / 2) - 8),
        width: w,
        zIndex: 10,
        flexDirection: "column",
        backgroundColor: POND_BG_HEX,
        border: true,
        borderStyle: "rounded",
        borderColor: accent,
        padding: 1,
      }}
    >
      <text bg={PANEL} fg={accent}>
        {mode === "delete" ? "delete a chat" : "resume a chat"}
      </text>
      <text bg={PANEL} fg={FAINT}>
        {mode === "delete" ? "↑/↓ select · enter delete · esc cancel" : "↑/↓ select · enter open · esc cancel"}
      </text>
      <box style={{ height: 1 }} />
      {rows.map((s, i) => (
        <text key={s.slug} bg={i === index ? SEL_BG : PANEL}>
          <span fg={i === index ? accent : FAINT}>{i === index ? "▐ " : "  "}</span>
          <span fg={i === index ? INK : MUTED}>{truncate(s.name, w - 14)}</span>
          <span fg={FAINT}>{`  ${s.count}msg`}</span>
        </text>
      ))}
    </box>
  );
}

// ---- Projects (layout A: index + dossier) --------------------------------------------------
// The project list starts on the bundled snapshot (synchronous, so the first paint never
// waits) and swaps in the live one: the daily cron's copy via /api/projects in the browser,
// the store over SSH.
function useProjects(): Project[] {
  const [list, setList] = useState<Project[]>(projects);
  useEffect(() => {
    let alive = true;
    getProjects()
      .then((live) => {
        if (alive) setList(live);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

// Every label here is auto-derived (src/lib/project-labels.ts). The index lists wins first
// (newest win first), then one group per derived category, largest first; the dossier shows
// the selected repo. Selection indexes the flattened group order.
const INDEX_W = 34;
type Group = { name: string; items: Project[] };
function projectGroups(list: Project[]): Group[] {
  const wins = list.filter((p) => p.award).sort((a, b) => (b.award?.at ?? "").localeCompare(a.award?.at ?? ""));
  const byCat = new Map<string, Project[]>();
  for (const p of list) if (!p.award) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  const cats = [...byCat].sort((a, b) => b[1].length - a[1].length).map(([name, items]) => ({ name: name.toUpperCase(), items }));
  return [{ name: "WINS", items: wins }, ...cats].filter((g) => g.items.length > 0);
}
const ORIGIN_LABEL: Record<Project["origin"], string> = {
  hackathon: "HACKATHON BUILD",
  personal: "PERSONAL PROJECT",
  research: "RESEARCH",
  contrib: "CONTRIBUTOR",
};
const STATUS_MARK: Record<Project["status"], { ch: string; col: string }> = {
  active: { ch: "●", col: LIVE },
  recent: { ch: "●", col: "#5f9e7c" },
  shipped: { ch: "◆", col: MUTED },
  dormant: { ch: "○", col: FAINT },
  archived: { ch: "○", col: FAINT },
};
const yy = (p: Project) => `'${String(p.year).slice(2)}`;

// language mix by bytes as one coloured bar, `w` cells wide (langs under 2% dropped)
function LangBar({ p, w }: { p: Project; w: number }) {
  const langs = p.langs.filter((l) => l.pct >= 2);
  const sum = langs.reduce((a, l) => a + l.pct, 0) || 1;
  let used = 0;
  return (
    <text bg={PANEL} wrapMode="none" style={{ height: 1 }}>
      {langs.map((l, i) => {
        const n = i === langs.length - 1 ? w - used : Math.max(1, Math.round((l.pct / sum) * w));
        used += n;
        return (
          <span key={l.name} fg={techTag(l.name).col}>
            {"━".repeat(Math.max(0, n))}
          </span>
        );
      })}
    </text>
  );
}

function ProjectIndex({ groups, selected, width, rows, onSelect }: { groups: Group[]; selected: number; width: number; rows: number; onSelect: (i: number) => void }) {
  type Row = { kind: "gap" } | { kind: "head"; name: string; n: number } | { kind: "item"; p: Project; i: number };
  const all: Row[] = [];
  let i = 0;
  for (const g of groups) {
    if (all.length) all.push({ kind: "gap" });
    all.push({ kind: "head", name: g.name, n: g.items.length });
    for (const p of g.items) all.push({ kind: "item", p, i: i++ });
  }
  // scroll window: keep the selection about a third of the way down
  const at = all.findIndex((r) => r.kind === "item" && r.i === selected);
  const start = Math.max(0, Math.min(at - Math.floor(rows / 3), all.length - rows));
  const nameW = width - 12;
  return (
    <box style={{ width, flexDirection: "column", flexShrink: 0 }}>
      {all.slice(start, start + rows).map((r, k) =>
        r.kind === "gap" ? (
          <box key={`g${k}`} style={{ height: 1 }} />
        ) : r.kind === "head" ? (
          <text key={`h${r.name}`} bg={PANEL}>
            <span fg={MUTED}>{`  ${r.name}`}</span>
            <span fg={FAINT}>{`  ${r.n}`}</span>
          </text>
        ) : (
          <box key={r.p.repo} onMouseDown={() => onSelect(r.i)}>
            <text bg={r.i === selected ? SEL_BG : PANEL} wrapMode="none">
              <span fg={r.i === selected ? ACCENT : FAINT}>{r.i === selected ? " ▐▌ " : "    "}</span>
              <span fg={r.i === selected ? INK : MUTED}>{truncate(r.p.title, nameW - 1).padEnd(nameW)}</span>
              <span fg={r.p.award ? STAR : FAINT}>{r.p.award ? "★" : " "}</span>
              <span fg={FAINT}>{` ${yy(r.p)}`}</span>
            </text>
          </box>
        ),
      )}
    </box>
  );
}

function ProjectDossier({ p, w, narrow, tight }: { p: Project; w: number; narrow: boolean; tight: boolean }) {
  const st = STATUS_MARK[p.status];
  const col2 = narrow || w < 52 ? 14 : 20;
  // short terminal: drop the blank spacer rows, or yoga shrinks the text rows onto each other
  const gap = tight ? 0 : 1;
  // 64-79 cols: the dossier is under 40 cells; clip rows at the screen edge instead of wrapping them
  // stacked on a short screen: clip instead of wrapping, or a wrapped row overprints the next
  const wm = (narrow ? tight : w < 40) ? "none" : undefined;
  return (
    <box style={{ flexGrow: 1, flexDirection: "column", paddingLeft: 2, paddingRight: 2, paddingTop: 1 }}>
      {p.award ? (
        <text bg={PANEL} wrapMode="none">
          <span fg={STAR}>{"★ "}</span>
          <span fg={INK}>{truncate(`${p.award.place} · ${p.award.event}`.toUpperCase(), w - 12)}</span>
          <span fg={FAINT}>{`  ${p.award.when}`}</span>
        </text>
      ) : (
        <text bg={PANEL} fg={FAINT}>
          {ORIGIN_LABEL[p.origin]}
        </text>
      )}
      <text bg={PANEL} wrapMode={wm}>
        <strong fg={INK}>{p.title}</strong>
        <span fg={FAINT}>{`   ${p.repo.split("/")[0]}/`}</span>
      </text>
      <box style={{ height: gap }} />
      {wrapText(p.summary, w)
        .slice(0, narrow && tight ? 2 : 3)
        .map((line, i) => (
          <text key={i} bg={PANEL} fg={MUTED}>
            {line}
          </text>
        ))}
      <box style={{ height: gap }} />
      <Rule w={w} />
      <box style={{ height: gap }} />
      <text bg={PANEL} wrapMode={wm}>
        <span fg={MUTED}>{"category  "}</span>
        <span fg={INK}>{p.category.padEnd(col2)}</span>
        <span fg={MUTED}>{"year  "}</span>
        <span fg={INK}>{String(p.year)}</span>
      </text>
      <text bg={PANEL} wrapMode={wm}>
        <span fg={MUTED}>{"role      "}</span>
        <span fg={INK}>{`${p.role} · ${Math.round(p.share * 100)}%`.padEnd(col2)}</span>
        <span fg={MUTED}>{"now   "}</span>
        <span fg={st.col}>{`${st.ch} `}</span>
        <span fg={INK}>{p.status}</span>
      </text>
      <text bg={PANEL} wrapMode={wm}>
        <span fg={MUTED}>{"stack     "}</span>
        {p.stack.slice(0, narrow ? 4 : 6).map((t) => {
          const { tag, col } = techTag(t);
          return <span key={t} fg={col}>{`● ${tag}   `}</span>;
        })}
      </text>
      <box style={{ height: gap }} />
      <LangBar p={p} w={w} />
      <text bg={PANEL} wrapMode={wm}>
        {p.langs.slice(0, narrow ? 2 : 4).map((l) => (
          <span key={l.name}>
            <span fg={techTag(l.name).col}>{"● "}</span>
            <span fg={MUTED}>{`${l.name} `}</span>
            <span fg={FAINT}>{`${l.pct}%   `}</span>
          </span>
        ))}
      </text>
      <box style={{ height: gap }} />
      {p.githubUrl && <LinkLine label="GitHub" href={p.githubUrl} text={p.githubUrl} wrapMode={wm} />}
      {p.eventUrl && <LinkLine label="Event" href={p.eventUrl} text={p.eventUrl.split("?")[0]} wrapMode={wm} />}
    </box>
  );
}

function Projects({ list, selected, onSelect }: { list: Project[]; selected: number; onSelect: (i: number) => void }) {
  const { width, height } = useTerminalDimensions();
  const narrow = width < 64;
  // header (pad+title+rule = 3) + footer (rule+nav+pad = 3): anything taller overflows the
  // screen and yoga flex-shrinks the HEADER by the excess — the title row silently vanishes
  const bodyRows = Math.max(4, height - 6);
  const groups = projectGroups(list);
  const order = groups.flatMap((g) => g.items);
  if (order.length === 0) return null;
  const sel = Math.min(selected, order.length - 1);
  const p = order[sel];
  if (narrow) {
    // rows left under the header/footer chrome and the top pad; the full dossier is 20 rows, the
    // tight one (no spacers, 2-line summary) 13. Overflow makes yoga shrink text rows onto each other.
    const avail = height - 7;
    const tight = avail < 25;
    return (
      <box style={{ flexDirection: "column", flexGrow: 1, paddingTop: 1 }}>
        <ProjectIndex groups={groups} selected={sel} width={width} rows={Math.max(3, Math.min(9, avail - (tight ? 13 : 20)))} onSelect={onSelect} />
        <ProjectDossier p={p} w={width - 4} narrow tight={tight} />
      </box>
    );
  }
  return (
    <box style={{ flexDirection: "row", flexGrow: 1 }}>
      <box style={{ flexDirection: "column", paddingTop: 1, flexShrink: 0 }}>
        <ProjectIndex groups={groups} selected={sel} width={INDEX_W} rows={bodyRows - 1} onSelect={onSelect} />
      </box>
      <VRule rows={bodyRows} />
      <ProjectDossier p={p} w={Math.min(88, width - INDEX_W - 6)} narrow={false} tight={bodyRows < 22} />
    </box>
  );
}

// ---- Home (profile + experience + wins + live) ----------------------------------------------
// Everything is derived: wins from LinkedIn honours, "building" from the most recently
// pushed personal repo, "writes in" from each repo's code languages weighted by his commits.
// notebooks are Python; markup and build files are not "writing in" anything
const NON_CODE = ["HTML", "CSS", "SCSS", "Dockerfile", "Makefile", "Procfile", "Batchfile", "MDX", "Nix", "TeX", "CMake"];
const LANG_AS: Record<string, string> = { "Jupyter Notebook": "Python" };
function writesIn(list: Project[]): { name: string; pct: number }[] {
  const acc = new Map<string, number>();
  for (const p of list) {
    const code = p.langs.filter((l) => !NON_CODE.includes(l.name));
    const sum = code.reduce((a, l) => a + l.pct, 0) || 1;
    for (const l of code) {
      const name = LANG_AS[l.name] ?? l.name;
      acc.set(name, (acc.get(name) ?? 0) + (l.pct / sum) * p.commits);
    }
  }
  const total = [...acc.values()].reduce((a, b) => a + b, 0) || 1;
  return [...acc].map(([name, v]) => ({ name, pct: (v / total) * 100 })).sort((a, b) => b.pct - a.pct);
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function birthday(dob?: string): string {
  const [m, d, y] = (dob ?? "").split("/").map(Number);
  return m && d && y ? `${MONTHS[m - 1]} ${d}, ${y}` : "";
}
// "Aug 2026" -> "AUG 26", the same stamp the wins list uses
const stamp = (when: string) => `${when.slice(0, 3).toUpperCase()} ${when.slice(-2)}`;
// a named award ("Best Freshers") reads as a prize; the award's name moves to the event column
const RANKED = /^(1st|2nd|3rd|Top \d+|Winner|Track Prize)/;

function Field({ k, children }: { k: string; children: ReactNode }) {
  return (
    <text bg={PANEL} wrapMode="none">
      <span fg={MUTED}>{k.padEnd(12)}</span>
      {children}
    </text>
  );
}
function FieldLink({ k, href, text }: { k: string; href: string; text: string }) {
  return (
    <Field k={k}>
      <a href={href} fg={ACCENT} attributes={TextAttributes.UNDERLINE}>
        {text}
      </a>
      <span fg={FAINT}> {EXTERNAL_LINK_ARROW}</span>
    </Field>
  );
}

// The landing screen: who he is on the left (banner, now, studies, links), what he has done
// and what is live on the right (experience, wins, GitHub, Spotify, languages by commits).
// Below TWO_COL columns it stacks into one column. The screen never scrolls, so sections are
// budgeted against the rows left: the least useful ones (writes-in, then music) drop first,
// then the wins and experience lists shorten, so a row is never squeezed onto another.
const LEFT_W = 66; // the widest left-column copy: the ARHAANSH banner (65)
const TWO_COL = LEFT_W + 6 + 56;
const MUSIC_ROWS = 10; // RECENTLY PLAYED: label, 6 tracks, gap, controls, margin
const GH_ROWS = 3; // GITHUB: label, stats, margin

function Home({ linkedIn, list, volume }: { linkedIn: LinkedInSnapshot; list: Project[]; volume?: VolumeChannel }) {
  const { width, height } = useTerminalDimensions();
  // github data lives here so the music controls can align to the stats row's ★ column
  const [gh, setGh] = useState<GitHubPulse | null>(null);
  useEffect(() => {
    let alive = true;
    getGitHub()
      .then((d) => {
        if (alive) setGh(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const narrow = width < 80;
  const twoCol = width >= TWO_COL;
  const wins = parseHonours((linkedIn.sections ?? []).find((s) => s.title === "Honors & Awards")?.items ?? []);
  const languages = [...new Set(((linkedIn.sections ?? []).find((s) => s.title === "Languages")?.items ?? []).map(compactLanguage))].filter(Boolean);
  const copyW = twoCol ? LEFT_W : width - 4;
  // as many languages as fit on the line, no ellipsis
  let speaks = "";
  for (const l of languages) {
    const next = speaks ? `${speaks} · ${l}` : l;
    if (next.length <= copyW - 12) speaks = next;
  }
  const building = list.filter((p) => p.origin === "personal").sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))[0];
  const job = profile.work.find((w) => !w.to);
  const work = profile.work;
  const research = profile.research;
  // the résumé lives on the site; an absolute link works from SSH too
  const resumeUrl = profile.links.resume ? `https://${profile.site}${profile.links.resume}` : "";
  const nowRows = 1 + (building ? 1 : 0) + (job ? 1 : 0) + (wins[0] ? 1 : 0) + (profile.dob ? 1 : 0);
  const aboutRows = profile.studies.length + 1 + (speaks ? 1 : 0);
  // rows under the header/footer chrome (6) and the top pad
  const avail = height - 7;
  const leftRows = (nameRows: number, gap: number, linkRows: number) => nameRows + gap + 1 + gap + nowRows + gap + aboutRows + gap + linkRows;
  const bigRows = bannerRows(banner(profile.name, true, copyW));
  const smallRows = bannerRows(banner(profile.name, false, copyW));
  // the left column (or, stacked, the top block) shrinks first: small banner, then no spacers
  // and the links on one row
  const fits = (rows: number) => (twoCol ? rows <= avail : rows + 12 <= avail);
  const fullLinkRows = resumeUrl ? 4 : 3;
  const compact = narrow || !fits(leftRows(bigRows, 1, fullLinkRows));
  const tight = !fits(leftRows(smallRows, 1, fullLinkRows));
  const gap = tight ? 0 : 1;
  const name = banner(profile.name, !compact, copyW);
  const linkRows = tight ? 1 : fullLinkRows;
  // the right-hand sections, in priority order, against what is left of the column
  let room = twoCol ? avail : avail - leftRows(bannerRows(name), gap, linkRows) - gap;
  const nExp = Math.max(0, Math.min(work.length, room - 1));
  room -= nExp ? 1 + nExp + gap : 0;
  const nResearch = Math.max(0, Math.min(research.length, room - 1));
  room -= nResearch ? 1 + nResearch + gap : 0;
  const nWins = Math.max(0, Math.min(wins.length, room - 1));
  room -= nWins ? 1 + nWins + gap : 0;
  const showGh = room >= GH_ROWS;
  room -= showGh ? GH_ROWS : 0;
  const showMusic = room >= MUSIC_ROWS;
  room -= showMusic ? MUSIC_ROWS : 0;
  const nWrites = Math.max(0, Math.min(narrow ? 4 : 6, room - 1));
  const writesShown = writesIn(list).slice(0, nWrites);
  const role = `${profile.role}${job ? ` @ ${job.org}` : ""}`.toLowerCase();
  const tagline = `${role}  ·  ${profile.studies.map((s) => s.school).join(" and ").toLowerCase()}`;
  const short = (place: string) => (place.startsWith("1st") ? "1st" : !RANKED.test(place) || place === "Track Prize" ? "prize" : place.split(" · ")[0]);
  const event = (h: { place: string; event: string }) => `${h.event.replace(/ Hackathon$/i, "")}${RANKED.test(h.place) ? "" : ` · ${h.place.toLowerCase()}`}`;
  const barW = narrow ? Math.max(8, width - 4 - 22) : 30;
  const listW = narrow ? width - 20 : 40;
  const bare = (u: string) => u.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");
  // tight: github · linkedin · email on one row, as many as fit the width
  let linkW = narrow ? 0 : 12;
  const tightLinks = [
    { href: profile.links.github, text: bare(profile.links.github) },
    { href: profile.links.linkedin, text: bare(profile.links.linkedin) },
    { href: `mailto:${profile.links.email}`, text: profile.links.email },
    ...(resumeUrl ? [{ href: resumeUrl, text: "résumé" }] : []),
  ].filter((l) => (linkW += l.text.length + 3) - 3 <= copyW);
  const left = (
    <box style={{ flexDirection: "column", width: twoCol ? LEFT_W : undefined, flexShrink: 0 }}>
      {name.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <box style={{ height: 1 }} />}
          {line.map((row, i) => (
            <text key={i} bg={PANEL} fg={BANNER_SHADE[line.length > 2 ? i : i * 2]} wrapMode="none">
              {row}
            </text>
          ))}
        </Fragment>
      ))}
      <box style={{ height: gap }} />
      <text bg={PANEL} fg={ACCENT} wrapMode="none">
        {narrow ? role : tagline}
      </text>
      <box style={{ height: gap }} />
      <text bg={PANEL} fg={MUTED}>
        NOW
      </text>
      {building && (
        <Field k="building">
          <span fg={INK}>{truncate(`${building.title} — pushed ${timeAgo(building.pushedAt)}`, copyW - 12)}</span>
        </Field>
      )}
      {job && (
        <Field k="working">
          <span fg={INK}>{job.role}</span>
          <span fg={MUTED}>{` @ ${job.org}`}</span>
        </Field>
      )}
      {wins[0] && (
        <Field k="last win">
          <span fg={LIVE}>{truncate(wins[0].place === "Winner" ? event(wins[0]) : `${short(wins[0].place)} · ${event(wins[0])}`, copyW - 12)}</span>
        </Field>
      )}
      {profile.dob && (
        <Field k="birthday">
          <span fg={INK}>{birthday(profile.dob)}</span>
        </Field>
      )}
      <box style={{ height: gap }} />
      {profile.studies.map((s, i) => (
        <Field key={s.school} k={i === 0 ? "studying" : ""}>
          <span fg={INK}>{truncate(s.degree, copyW - 12 - s.school.length - 3)}</span>
          <span fg={MUTED}>{` · ${s.school}`}</span>
        </Field>
      ))}
      <Field k="based">
        <span fg={INK}>{(narrow ? profile.based.map((l) => l.split(",")[0]) : profile.based).join(narrow ? " · " : "  ·  ")}</span>
      </Field>
      {speaks && (
        <Field k="speaks">
          <span fg={INK}>{speaks}</span>
        </Field>
      )}
      <box style={{ height: gap }} />
      {tight ? (
        <text bg={PANEL} wrapMode="none">
          {tightLinks.map((l, i) => (
            <span key={l.text}>
              <span fg={FAINT}>{i === 0 ? (narrow ? "" : "links".padEnd(12)) : "   "}</span>
              <a href={l.href} fg={ACCENT} attributes={TextAttributes.UNDERLINE}>{l.text}</a>
            </span>
          ))}
        </text>
      ) : (
        <>
          <FieldLink k="github" href={profile.links.github} text={bare(profile.links.github)} />
          <FieldLink k="linkedin" href={profile.links.linkedin} text={bare(profile.links.linkedin)} />
          <FieldLink k="email" href={`mailto:${profile.links.email}`} text={profile.links.email} />
          {resumeUrl && <FieldLink k="résumé" href={resumeUrl} text={bare(resumeUrl)} />}
        </>
      )}
    </box>
  );
  const live = (
    <box style={{ flexDirection: "column" }}>
      {showGh && <GitHubPulse g={gh} />}
      {showMusic && <NowPlaying volume={volume} controlsWidth={gh ? ghStatsWidth(gh) : undefined} />}
    </box>
  );
  const right = (
    <box style={{ flexDirection: "column", paddingLeft: twoCol ? 6 : 0, paddingTop: twoCol ? 0 : gap }}>
      {nExp > 0 && (
        <>
          <text bg={PANEL}>
            <span fg={MUTED}>EXPERIENCE</span>
            <span fg={FAINT}>{`  ${work.length}`}</span>
          </text>
          {work.slice(0, nExp).map((w) => (
            <text key={w.org} bg={PANEL} wrapMode="none">
              <span fg={FAINT}>{`${stamp(w.from)}  `}</span>
              <span fg={w.to ? FAINT : LIVE}>{(w.to ? stamp(w.to) : "now").padEnd(8)}</span>
              <span fg={INK}>{truncate(w.role, listW)}</span>
              <span fg={MUTED}>{truncate(` @ ${w.org}`, Math.max(0, listW - w.role.length))}</span>
            </text>
          ))}
          <box style={{ height: gap }} />
        </>
      )}
      {nResearch > 0 && (
        <>
          <text bg={PANEL}>
            <span fg={MUTED}>RESEARCH</span>
            <span fg={FAINT}>{`  ${research.length}`}</span>
          </text>
          {research.slice(0, nResearch).map((r) => (
            <text key={r.title} bg={PANEL} wrapMode="none">
              <span fg={FAINT}>{`${stamp(r.when)}  `}</span>
              <span fg={r.status.startsWith("Accepted") ? INK : MUTED}>{r.tag.padEnd(8)}</span>
              <span fg={INK}>{truncate(r.title, listW)}</span>
            </text>
          ))}
          <box style={{ height: gap }} />
        </>
      )}
      {nWins > 0 && (
        <>
          <text bg={PANEL}>
            <span fg={MUTED}>WINS</span>
            <span fg={FAINT}>{`  ${wins.length}`}</span>
          </text>
          {wins.slice(0, nWins).map((h) => (
            <text key={h.text} bg={PANEL} wrapMode="none">
              <span fg={FAINT}>{`${stamp(h.when)}  `}</span>
              {/* every row is a win: the star says so; only another placing is spelled out */}
              <span fg={STAR}>{"★ "}</span>
              <span fg={INK}>{(h.place === "Winner" ? "" : short(h.place)).padEnd(6)}</span>
              <span fg={MUTED}>{truncate(event(h), listW)}</span>
            </text>
          ))}
          <box style={{ height: gap }} />
        </>
      )}
      {/* the vertical volume bar runs down the left of the live block, as on the old home */}
      {twoCol && showMusic ? (
        <box style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <box style={{ flexDirection: "column", paddingRight: 2 }}>
            <VolumeBar channel={volume} />
          </box>
          {live}
        </box>
      ) : (
        live
      )}
      {nWrites > 0 && (
        <>
          <text bg={PANEL}>
            <span fg={MUTED}>WRITES IN</span>
            <span fg={FAINT}>{"  by his commits"}</span>
          </text>
          {writesShown.map((l) => (
            <text key={l.name} bg={PANEL} wrapMode="none">
              <span fg={MUTED}>{l.name.padEnd(12)}</span>
              <span fg={techTag(l.name).col}>{"▆".repeat(Math.max(1, Math.round((l.pct / (writesShown[0]?.pct || 1)) * barW)))}</span>
              <span fg={FAINT}>{` ${Math.round(l.pct)}%`}</span>
            </text>
          ))}
        </>
      )}
    </box>
  );
  return (
    <box style={{ flexDirection: twoCol ? "row" : "column", paddingLeft: 2, paddingTop: 1 }}>
      {left}
      {right}
    </box>
  );
}

// word-wrap to width, preserving explicit newlines; hard-breaks words longer than w
function wrapText(s: string, w: number): string[] {
  const out: string[] = [];
  for (const raw of s.split("\n")) {
    let line = "";
    for (const word of raw.split(" ")) {
      if (line.length === 0) line = word;
      else if (line.length + 1 + word.length <= w) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    while (line.length > w) {
      out.push(line.slice(0, w));
      line = line.slice(w);
    }
    out.push(line);
  }
  return out;
}

function Chat({
  messages,
  sending,
  input,
  inputKey,
  scroll,
  inputActive,
  onInput,
  onSubmit,
}: {
  messages: ChatMessage[];
  sending: boolean;
  input: string;
  inputKey: number;
  scroll: number;
  inputActive: boolean;
  onInput: (v: string) => void;
  onSubmit: (v: string) => void;
}) {
  // Word-wrap + row windowing done in plain JS: every rendered line is a fixed
  // height-1 <text>, so the layout can never overflow and push the input off-screen
  // (opentui text measurement has exact-fit quirks that broke flex/scrollbox layouts).
  const { width: termW, height: termH } = useTerminalDimensions();
  const bodyW = Math.max(10, termW - 6); // 2 pad each side + 2-char prefix
  const rows: { prefix: string; body: string; pc: string; bc: string }[] = [];
  for (const m of messages) {
    const isErr = m.content.startsWith("OPENROUTER_API_KEY");
    const wrapped = wrapText(m.content, bodyW);
    wrapped.forEach((line, li) => {
      if (m.role === "user") rows.push({ prefix: li === 0 ? "> " : "  ", body: line, pc: MUTED, bc: INK });
      else rows.push({ prefix: li === 0 ? "⏺ " : "  ", body: line, pc: isErr ? ERR : ACCENT, bc: isErr ? ERR : INK });
    });
    rows.push({ prefix: "", body: "", pc: MUTED, bc: INK }); // blank line between messages
  }
  if (rows.length > 0) rows.pop();
  // rows available: header 3 + chat paddingTop 1 + rule 1 + input 1 + footer 3 = 9
  const avail = Math.max(3, termH - 9 - (sending ? 1 : 0));
  const off = Math.min(scroll, Math.max(0, rows.length - avail));
  const visible = rows.slice(Math.max(0, rows.length - avail - off), rows.length - off);
  return (
    <box style={{ flexGrow: 1, flexDirection: "column", paddingTop: 1 }}>
      <box style={{ flexGrow: 1, flexDirection: "column", paddingLeft: 2, paddingRight: 2 }}>
        {messages.length === 0 && (
          <text bg={PANEL} fg={FAINT} wrapMode="none" style={{ height: 1 }}>
            {`Ask about ${profile.name.split(" ")[0]} — ML work, projects, wins, stack, links. Type /help for commands.`}
          </text>
        )}
        {visible.map((r, i) => (
          <text key={i} bg={PANEL} wrapMode="none" style={{ height: 1 }}>
            <span fg={r.pc}>{r.prefix}</span>
            <span fg={r.bc}>{r.body}</span>
          </text>
        ))}
        {sending && <ThinkingDots />}
      </box>
      <Rule />
      <box style={{ flexDirection: "row", paddingLeft: 2, paddingRight: 2 }}>
        {/* trailing-space text also measures 2 wrapped rows (same quirk) — pin it */}
        <text bg={PANEL} fg={ACCENT} wrapMode="none" style={{ height: 1 }}>{"> "}</text>
        <input
          key={inputKey}
          focused={inputActive}
          placeholder="ask a question…   (/help)"
          value={input}
          onInput={onInput}
          style={{ flexGrow: 1 }}
          // opentui types onSubmit as an intersection over its own event type; guard at runtime.
          onSubmit={(value: unknown) => {
            if (typeof value === "string") onSubmit(value);
          }}
        />
      </box>
    </box>
  );
}
