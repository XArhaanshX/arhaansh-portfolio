// Platform-neutral request handler for the browser product: the HTML shell, the /api/*
// data endpoints and the SEO files. Shared by the Bun server (server/web.ts) and the
// Cloudflare Worker (server/worker.ts); /app.js and the favicon are served by each host.
import { PAGE_TITLE, SEO_HEAD, seoBody, robotsTxt, sitemapXml, llmsTxt } from "./seo";
import { phonePage } from "./phone";
import { getSpotify } from "@/lib/spotify";
import { getPreviewUrl } from "@/lib/preview";
import { getLinkedInSnapshot } from "@/lib/linkedin";
import { recordVisit } from "@/lib/visits";
import { capture } from "@/lib/analytics";
import { ask, type ChatMessage } from "@/lib/ai";
import { recordQuestion } from "@/lib/questions";
import { getGitHub } from "@/lib/github";
import { getProjects } from "@/lib/projects";
import { beat, liveCount } from "@/lib/presence";

const PORT = Number(process.env.PORT ?? 8787);

// HTML shell for the DOM app (served at /): same aesthetic (bg, CRT overlays, SEO), no xterm.
const APP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${PAGE_TITLE}</title>${SEO_HEAD}
<link rel="icon" type="image/png" href="/favicon.png" />
<meta name="theme-color" content="#030c0d" />
<style>
  html{color-scheme:dark;}
  html,body{margin:0;height:100%;background:#030c0d;overflow:hidden;}
  /* taps act at once (no double-tap-zoom wait) and without the grey flash */
  body{touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
  #app{position:fixed;top:0;left:0;right:0;height:100dvh;box-sizing:border-box;}
  /* no filter on #app: the brightness(1.08) saturate(1.18) grade is baked into the colours
     (web/dom/tone.ts), because a viewport-sized filter re-runs on every pond frame (slow at 4K) */
  /* #root paints the text grid over the pond canvas (explicit z-index: the canvas must
     never composite above the text); cell size comes from --cw/--lh (metrics.ts) */
  #root{position:absolute;inset:0;z-index:1;color:#fbfffb;font:14px/19px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        -webkit-font-smoothing:antialiased;}
  #root input::placeholder{color:#5b6d64;opacity:1;}
  #root a{cursor:pointer;}
  /* keyboard focus is visible on links and tappable rows; a click never shows the ring */
  #root a:focus-visible,#root [role=button]:focus-visible{outline:1px solid #43f08a;outline-offset:1px;}
  #root [role=button]:focus:not(:focus-visible){outline:none;}
  /* 16px stops iOS auto-zoom on focus; the grid still sizes rows via --lh */
  @media (pointer: coarse){ #root input{font-size:16px;} }
  /* static scanlines: the old 4s opacity "flicker" moved their strength by ~2%, invisible, but
     re-composited the whole viewport ten times a second (very slow at 4K) */
  .crt-overlay{
    position:fixed;inset:0;z-index:10;pointer-events:none;
    background:repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px, rgba(0,0,0,0.32) 2px);
  }
  /* vignette + faint green tint in one layer; a normal-blend tint instead of mix-blend-mode:
     screen, which forced a full-viewport backdrop read every frame */
  .crt-vignette{
    position:fixed;inset:0;z-index:9;pointer-events:none;
    background:radial-gradient(140% 140% at 50% 50%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.45) 100%), rgba(67,240,138,0.04);
  }
  /* "Enter portfolio": the edition chooser over the pond on a first visit (web/chooser.ts) */
  .chooser{position:fixed;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:24px;
    font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#e9ece9;}
  .ch-panel{width:min(520px,100%);background:#030c0d;border:1px solid #2c3531;padding:28px;}
  .ch-site{margin:0;color:#7c8a82;font-size:13px;}
  .ch-title{margin:6px 0 0;font-size:22px;font-weight:600;}
  .ch-role{margin:2px 0 0;color:#43f08a;}
  .ch-q{margin:24px 0 10px;color:#7c8a82;}
  .ch-opts{display:grid;gap:10px;}
  .ch-opt{display:grid;gap:2px;text-align:left;width:100%;min-height:64px;padding:12px 14px;background:none;color:inherit;
    font:inherit;border:1px solid #2c3531;cursor:pointer;}
  .ch-opt:hover{border-color:#56645d;}
  .ch-opt.ch-suggested{border-color:#43f08a;}
  .ch-opt:focus-visible{outline:2px solid #43f08a;outline-offset:2px;}
  .ch-name{font-weight:600;}
  .ch-tag{margin-left:8px;color:#43f08a;font-weight:400;font-size:13px;}
  .ch-desc{color:#7c8a82;font-size:14px;}
  .ch-note{margin:14px 0 0;color:#6f7d75;font-size:13px;}
  .seo-content{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
</style>
<noscript><style>
  /* no JS: hide the terminal and show the SEO block as a plain page */
  html,body{overflow:auto;}
  #app,.crt-overlay,.crt-vignette{display:none;}
  .seo-content{position:static;width:auto;height:auto;margin:0 auto;clip:auto;overflow:visible;white-space:normal;
    max-width:72ch;padding:32px 20px;color:#e9ece9;font:16px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
  .seo-content a{color:#43f08a;}
</style></noscript>
</head>
<body>
<!--seo-body-->
<div id="app"><div id="root"></div></div>
<div class="crt-vignette"></div>
<div class="crt-overlay"></div>
<script type="module" src="/app.js"></script>
</body>
</html>`;

// /api/now-playing payload, cached 5s so many open tabs don't hammer Spotify
let nowCache: { at: number; body: string } | null = null;
async function nowPlayingJson(): Promise<string> {
  if (nowCache && Date.now() - nowCache.at < 5_000) return nowCache.body;
  const s = await getSpotify();
  const cur = s.isPlaying ? s.current : null;
  // derive the track id from the song url (https://open.spotify.com/track/{id})
  const id = cur?.songUrl?.split("/track/")[1]?.split("?")[0] || null;
  const previewUrl = id && cur ? await getPreviewUrl(id, cur.name, cur.artists[0] ?? "") : null;
  const body = JSON.stringify({
    playing: Boolean(cur),
    name: cur?.name ?? null,
    artists: cur?.artists ?? [],
    previewUrl,
  });
  nowCache = { at: Date.now(), body };
  return body;
}

// Same-origin policy for all mutating /api routes: the page's Origin must be an explicit
// allowed origin (localhost / PUBLIC_ORIGIN) or its host must equal the Host the page was
// served from (covers LAN IP / tunnel real-device access / *.workers.dev).
function sameOriginOk(req: Request): boolean {
  const origin = req.headers.get("origin") ?? "";
  const host = req.headers.get("host") ?? "";
  let originHost = "";
  try { originHost = origin ? new URL(origin).host : ""; } catch { originHost = ""; }
  const allowed = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);
  if (process.env.PUBLIC_ORIGIN) allowed.add(process.env.PUBLIC_ORIGIN);
  return allowed.has(origin) || (originHost !== "" && originHost === host);
}

// /api/chat proxies OpenRouter, so rate-limit it: token bucket, 10 req/min per IP.
// ponytail: in-memory, cleared wholesale past 10k IPs — fine for a portfolio site. On the
// Worker the bucket is per isolate, so the cap is per Cloudflare location, not global.
const chatBuckets = new Map<string, { tokens: number; at: number }>();
function chatAllowed(ip: string): boolean {
  const now = Date.now();
  if (chatBuckets.size > 10_000) chatBuckets.clear();
  const b = chatBuckets.get(ip) ?? { tokens: 10, at: now };
  b.tokens = Math.min(10, b.tokens + ((now - b.at) / 60_000) * 10);
  b.at = now;
  chatBuckets.set(ip, b);
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// `ip` is the client address (CF-Connecting-IP behind Cloudflare). `waitUntil` keeps
// fire-and-forget work (analytics) alive past the response — required on Workers.
export async function handle(req: Request, ip: string, waitUntil: (p: Promise<unknown>) => void): Promise<Response> {
  const url = new URL(req.url);
  // --- data endpoints for the DOM client (thin wrappers over src/lib) ---
  if (url.pathname.startsWith("/api/") && req.method === "POST" && !sameOriginOk(req))
    return new Response("forbidden", { status: 403 });
  if (url.pathname === "/api/boot" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { distinctId?: unknown };
    const distinctId = typeof body.distinctId === "string" ? body.distinctId.slice(0, 64) : "anon";
    const linkedIn = await getLinkedInSnapshot();
    const visit = await recordVisit();
    waitUntil(capture(distinctId, "visit", { count: visit.count }));
    return json({ linkedIn, visit });
  }
  if (url.pathname === "/api/spotify") return json(await getSpotify());
  if (url.pathname === "/api/preview") {
    const id = url.searchParams.get("id") ?? "";
    const name = url.searchParams.get("name") ?? "";
    const artist = url.searchParams.get("artist") ?? "";
    return json({ url: id ? await getPreviewUrl(id, name, artist) : null });
  }
  if (url.pathname === "/api/github") return json(await getGitHub());
  // the daily cron's labels (KV) or the committed snapshot; the browser twin reads this
  if (url.pathname === "/api/projects") return json(await getProjects());
  if (url.pathname === "/api/chat" && req.method === "POST") {
    if (!chatAllowed(ip)) return json({ error: "rate limited — try again in a minute" }, 429);
    const body = (await req.json().catch(() => null)) as { messages?: unknown } | null;
    const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : null;
    const valid =
      messages &&
      messages.length <= 50 &&
      messages.every(
        (m) =>
          (m?.role === "user" || m?.role === "assistant") &&
          typeof m?.content === "string" &&
          m.content.length <= 2000,
      );
    if (!valid || !messages) return json({ error: "bad request" }, 400);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) await recordQuestion(lastUser.content);
    return json(await ask(messages));
  }
  if (url.pathname === "/api/presence" && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { id?: unknown };
    if (typeof body.id === "string") beat(body.id.slice(0, 64));
    return json({ live: liveCount() });
  }
  if (url.pathname === "/api/event" && req.method === "POST") {
    const body = (await req.json().catch(() => null)) as
      | { distinctId?: unknown; event?: unknown; properties?: unknown }
      | null;
    if (body && typeof body.distinctId === "string" && typeof body.event === "string")
      waitUntil(
        capture(
          body.distinctId.slice(0, 64),
          body.event.slice(0, 64),
          body.properties && typeof body.properties === "object"
            ? (body.properties as Record<string, unknown>)
            : undefined,
        ),
      );
    return json({ ok: true });
  }
  if (url.pathname === "/api/now-playing")
    return new Response(await nowPlayingJson(), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  // SEO/GEO endpoints
  if (url.pathname === "/robots.txt") return new Response(robotsTxt(), { headers: { "content-type": "text/plain; charset=utf-8" } });
  if (url.pathname === "/sitemap.xml") return new Response(sitemapXml(), { headers: { "content-type": "application/xml; charset=utf-8" } });
  if (url.pathname === "/llms.txt") return new Response(llmsTxt(await getProjects()), { headers: { "content-type": "text/plain; charset=utf-8" } });
  // the phone edition: server-rendered, so it paints at once and reads without JS
  if (url.pathname === "/m" || url.pathname === "/m/")
    return new Response(phonePage(await getLinkedInSnapshot(), await getProjects()), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  // the SEO block lists the same projects the app shows, so it follows the cron too
  const seo = seoBody(await getProjects());
  const html = APP_HTML.replace("<!--seo-body-->", () => seo);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
