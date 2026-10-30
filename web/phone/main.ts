// /m.js: the phone edition's behaviour on top of the server-rendered page (server/phone.ts):
// the hero pond, the visit count, live GitHub and Spotify, the project filters and the chat.
import { startHeroPond } from "./pond";

type GitHubPulse = { commits?: number; contributions?: number; stars?: number; lastPushName?: string | null; lastPushAt?: string | null };
type Track = { name: string; artists: string[]; songUrl?: string };
type Spotify = { configured: boolean; isPlaying: boolean; current: Track | null; recent: { track: Track; playedAt: string }[] };
type Msg = { role: "user" | "assistant"; content: string };

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n?: number) => (typeof n === "number" ? new Intl.NumberFormat("en").format(n) : "–");
function ago(iso: string): string {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(m) || m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const post = (path: string, body: unknown) =>
  fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// this browser chose the phone edition (the chooser on / reads it)
localStorage.setItem("version", "phone");

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pond = $<HTMLCanvasElement>("canvas.pond");
if (pond) startHeroPond(pond, reduced);

// the visit counts here as on the laptop edition; presence keeps "online" honest
const visits = $<HTMLElement>("[data-visits]");
let total = 0;
let online = 1;
const showVisits = () => {
  if (visits && total) visits.textContent = `Visitor #${num(total)}, ${online} online now`;
};
post("/api/boot", { distinctId: crypto.randomUUID() })
  .then((r) => r.json())
  .then((d: { visit?: { count?: number } }) => {
    total = d.visit?.count ?? 0;
    showVisits();
  })
  .catch(() => {});
const presenceId = crypto.randomUUID();
const beat = () =>
  post("/api/presence", { id: presenceId })
    .then((r) => r.json())
    .then((d: { live?: number }) => {
      if (typeof d.live === "number") online = d.live;
      showVisits();
    })
    .catch(() => {});
beat();
setInterval(() => document.visibilityState === "visible" && beat(), 15_000);

// live GitHub numbers
const gh = $<HTMLElement>("[data-gh]");
fetch("/api/github")
  .then((r) => r.json())
  .then((g: GitHubPulse | null) => {
    if (!gh || !g) return;
    gh.innerHTML = `<dl class="stats">
<div><dt>commits</dt><dd>${num(g.commits)}</dd></div>
<div><dt>contributions</dt><dd>${num(g.contributions)}</dd></div>
<div><dt>stars</dt><dd>${num(g.stars)}</dd></div>
</dl>${g.lastPushAt ? `<p class="pushed dim">Last push ${ago(g.lastPushAt)}${g.lastPushName ? ` to ${esc(g.lastPushName)}` : ""}</p>` : ""}`;
  })
  .catch(() => {
    if (gh) gh.innerHTML = `<p class="dim">GitHub stats are unavailable right now.</p>`;
  });

// what he is playing, or played last
const music = $<HTMLElement>("[data-music]");
const trackRow = (t: Track, cls = "") =>
  `<li><a href="${esc(t.songUrl ?? "#")}" rel="noopener" target="_blank"><span class="t ${cls}">${esc(t.name)}</span><span class="by">${esc(t.artists.join(", "))}</span></a></li>`;
const loadMusic = () =>
  fetch("/api/spotify")
    .then((r) => r.json())
    .then((s: Spotify) => {
      if (!music || !s?.configured) return;
      const now = s.isPlaying && s.current ? s.current : null;
      const recent = s.recent.filter((e) => !now || e.track.name !== now.name).slice(0, now ? 4 : 5);
      music.innerHTML =
        (now ? `<h3>Playing now</h3><ol>${trackRow(now, "playing")}</ol>` : "") +
        (recent.length ? `<h3${now ? ' style="margin-top:14px"' : ""}>Recently played${!now && s.recent[0] ? ` <span class="dim">${ago(s.recent[0].playedAt)}</span>` : ""}</h3><ol>${recent.map((e) => trackRow(e.track)).join("")}</ol>` : "");
      music.hidden = !now && recent.length === 0;
    })
    .catch(() => {});
loadMusic();
setInterval(() => document.visibilityState === "visible" && loadMusic(), 30_000);

// project filters: one category (or wins) at a time. Under "All" each group shows its first
// three behind a "Show all" button; a single category shows every project in it.
document.documentElement.classList.add("js");
const groups = [...document.querySelectorAll<HTMLElement>(".group")];
const filterButtons = [...document.querySelectorAll<HTMLButtonElement>(".filters button")];
for (const btn of filterButtons) {
  btn.addEventListener("click", () => {
    const f = btn.dataset.f ?? "all";
    for (const b of filterButtons) b.setAttribute("aria-pressed", String(b === btn));
    for (const g of groups) {
      g.hidden = f !== "all" && g.dataset.group !== f;
      g.classList.toggle("open", f !== "all");
    }
  });
}
for (const g of groups) {
  g.querySelector<HTMLButtonElement>("[data-showall]")?.addEventListener("click", () => {
    g.classList.add("open");
    // keep reading where the folded list continues
    g.querySelector<HTMLAnchorElement>(".project.more a")?.focus();
  });
}

// the chat: same assistant as the terminal's, plain text answers
const thread = $<HTMLElement>("[data-thread]");
const form = $<HTMLFormElement>("[data-ask]");
const input = $<HTMLInputElement>("#q");
const history: Msg[] = [];
const say = (cls: string, text: string) => {
  const p = document.createElement("p");
  p.className = cls;
  p.textContent = text;
  thread?.appendChild(p);
  return p;
};
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input?.value.trim();
  const button = form.querySelector("button");
  if (!q || !input || !button || button.disabled) return;
  history.push({ role: "user", content: q.slice(0, 2000) });
  say("you", q);
  input.value = "";
  button.disabled = true;
  button.textContent = "Asking…";
  const pending = say("bot dim", "Thinking…");
  try {
    const r = await post("/api/chat", { messages: history.slice(-50) });
    const d = (await r.json()) as { answer?: string; error?: string };
    pending.remove();
    if (d.answer) {
      history.push({ role: "assistant", content: d.answer });
      say("bot", d.answer);
    } else say("err", d.error ?? "No answer came back. Ask again in a moment.");
  } catch {
    pending.remove();
    say("err", "The assistant could not be reached. Check your connection and ask again.");
  } finally {
    button.disabled = false;
    button.textContent = "Ask";
  }
});

// back to the terminal edition, remembered for next time
$<HTMLButtonElement>("[data-switch]")?.addEventListener("click", () => {
  localStorage.setItem("version", "laptop");
  location.href = "/";
});
