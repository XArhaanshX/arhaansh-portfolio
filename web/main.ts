// Browser entry for the DOM-rendered app: the same tui/app.tsx tree, rendered by react-dom
// with local input handling (zero-RTT) — the server only serves data over /api/*.
// Deliberately JSX-free: this file typechecks in the tui tsconfig program (where JSX means
// opentui elements), so the App import stays type-safe without a JSX-type collision.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import App from "../tui/app";
import { initMetrics } from "./dom/metrics";
import { startPond } from "./dom/pond";
import { createVolumeChannel } from "./dom/volume";
import { chooseEdition } from "./chooser";

async function boot(): Promise<void> {
  const appEl = document.getElementById("app");
  const rootEl = document.getElementById("root");
  if (!appEl || !rootEl) return;
  // ?v=laptop or ?v=phone forces an edition; otherwise the remembered one, else ask
  const edition = new URLSearchParams(location.search).get("v") ?? localStorage.getItem("version");
  if (edition === "phone") {
    location.replace(`/m${location.hash}`);
    return;
  }
  initMetrics(rootEl);
  startPond(appEl); // koi visible immediately, on the same text grid, behind the boot screen's rows
  if (edition !== "laptop") await chooseEdition();
  localStorage.setItem("version", "laptop");
  const distinctId = crypto.randomUUID();
  try {
    const r = await fetch("/api/boot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ distinctId }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const { linkedIn, visit } = await r.json();
    // the full boot log plays once per browser session
    const quickBoot = sessionStorage.getItem("booted") === "1";
    sessionStorage.setItem("booted", "1");
    createRoot(rootEl).render(
      createElement(App, {
        linkedIn,
        visit,
        distinctId,
        // ponytail: no connection to close on the web — `q` lands on the goodbye screen; reload restarts
        onExit: () => {},
        volume: createVolumeChannel(),
        pond: false, // the DOM text-grid pond above replaces the cell-buffer KoiPond
        quickBoot,
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
        // arhaansh.me/#projects opens that screen; the hash follows navigation (no history entries)
        initialScreen: location.hash.slice(1) || undefined,
        onScreen: (screen: string) => history.replaceState(null, "", screen === "home" ? location.pathname : `#${screen}`),
        onSwitch: () => {
          localStorage.setItem("version", "phone");
          location.href = "/m";
        },
      }),
    );
  } catch {
    rootEl.textContent = "connection failed — reload to retry";
  }
}

void boot();
