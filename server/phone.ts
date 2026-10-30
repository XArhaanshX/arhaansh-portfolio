// The phone edition (/m): a server-rendered, scrolling page with the same data and palette as
// the terminal. Everything a visitor needs is in the HTML (fast first paint, readable without
// JS, crawlable); /m.js (web/phone/main.ts) adds the hero koi pond, live GitHub and Spotify,
// the project filters and the chat.
import { profile } from "@/lib/profile";
import { parseHonours, type Honour } from "@/lib/project-labels";
import type { LinkedInSnapshot } from "@/lib/linkedin";
import type { Project } from "@/lib/projects";
import { techTag } from "@/lib/tech";
import { BANNER_SHADE, banner } from "@/lib/banner";
import { PAGE_TITLE, SEO_HEAD } from "./seo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// "Aug 2026" stays as written; "2026-08-01" style dates are not used on this page
const RANKED = /^(1st|2nd|3rd|Top \d+|Winner|Track Prize)/;
const eventOf = (h: Pick<Honour, "place" | "event">) => `${h.event.replace(/ Hackathon$/i, "")}${RANKED.test(h.place) ? "" : ` (${h.place})`}`;
const placeOf = (place: string) => (RANKED.test(place) ? place.split(" · ")[0] : "Prize");

function ago(iso: string): string {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(m) || m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

// the block-letter name as one SVG: a rect per run of filled cells, shaded by row like the TUI
function bannerSvg(): string {
  const lines = banner(profile.name, true, 72);
  const w = Math.max(...lines.flatMap((l) => l.map((r) => r.trimEnd().length)));
  const rows: string[] = [];
  let y = 0;
  for (const line of lines) {
    line.forEach((row, r) => {
      for (const m of row.matchAll(/█+/g)) rows.push(`<rect x="${m.index}" y="${y + r}" width="${m[0].length}" height="1" fill="${BANNER_SHADE[r]}"/>`);
    });
    y += line.length + 1;
  }
  const h = y - 1;
  // a cell is ~1:2 like a terminal's, so the viewBox stretches y
  return `<svg class="banner" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="aspect-ratio:${w}/${h * 2}" aria-hidden="true" focusable="false"><g shape-rendering="crispEdges">${rows.join("")}</g></svg>`;
}

const NON_CODE = ["HTML", "CSS", "SCSS", "Dockerfile", "Makefile", "Procfile", "Batchfile", "MDX", "Nix", "TeX", "CMake"];
function writesIn(list: Project[]): { name: string; pct: number }[] {
  const acc = new Map<string, number>();
  for (const p of list) {
    const code = p.langs.filter((l) => !NON_CODE.includes(l.name));
    const sum = code.reduce((a, l) => a + l.pct, 0) || 1;
    for (const l of code) {
      const name = l.name === "Jupyter Notebook" ? "Python" : l.name;
      acc.set(name, (acc.get(name) ?? 0) + (l.pct / sum) * p.commits);
    }
  }
  const total = [...acc.values()].reduce((a, b) => a + b, 0) || 1;
  return [...acc].map(([name, v]) => ({ name, pct: (v / total) * 100 })).sort((a, b) => b.pct - a.pct);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// each group shows its first few; the rest fold behind "Show all" once the script runs
const FOLD = 3;

function projectItem(p: Project, i: number): string {
  const tags = p.stack
    .slice(0, 5)
    .map((t) => {
      const { tag, col } = techTag(t);
      return `<li style="--c:${col}" title="${esc(t)}">${esc(tag)}</li>`;
    })
    .join("");
  const owner = p.repo.split("/")[0];
  const link = p.githubUrl ? `<a class="out" href="${esc(p.githubUrl)}" rel="noopener" target="_blank">${owner === "XArhaanshX" ? "code" : `code on ${esc(owner)}`}<span aria-hidden="true"> ↗</span></a>` : "";
  return `<li class="project${i >= FOLD ? " more" : ""}">
<article>
${p.award ? `<p class="award"><span class="star" aria-hidden="true">★ </span>${esc(placeOf(p.award.place))}, ${esc(p.award.event)}</p>` : ""}
<h4>${esc(p.title)} <span class="year">${p.year}</span></h4>
<p class="sum">${esc(p.summary)}</p>
<div class="foot"><ul class="tags" aria-label="Stack">${tags}</ul>${link}</div>
</article>
</li>`;
}

export function phonePage(linkedIn: LinkedInSnapshot, projects: Project[]): string {
  const wins = parseHonours((linkedIn.sections ?? []).find((s) => s.title === "Honors & Awards")?.items ?? []);
  const languages = [...new Set(((linkedIn.sections ?? []).find((s) => s.title === "Languages")?.items ?? []).map((l) => l.replace(/\s+(native|full|professional|limited|elementary).*$/i, "").trim()))].filter(Boolean);
  const building = projects.filter((p) => p.origin === "personal").sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))[0];
  const job = profile.work.find((w) => !w.to);
  const first = profile.name.split(" ")[0];

  // wins first, then one group per category, largest first (the terminal's order)
  const winList = projects.filter((p) => p.award).sort((a, b) => (b.award?.at ?? "").localeCompare(a.award?.at ?? ""));
  const byCat = new Map<string, Project[]>();
  for (const p of projects) if (!p.award) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  const groups = [{ name: "Wins", key: "wins", items: winList }, ...[...byCat].sort((a, b) => b[1].length - a[1].length).map(([name, items]) => ({ name, key: slug(name), items }))].filter((g) => g.items.length);
  const filters = [`<button type="button" aria-pressed="true" data-f="all">All <span>${projects.length}</span></button>`, ...groups.map((g) => `<button type="button" aria-pressed="false" data-f="${g.key}">${esc(g.name)} <span>${g.items.length}</span></button>`)].join("");
  const projectGroups = groups
    .map(
      (g) =>
        `<li class="group" data-group="${g.key}"><h3>${esc(g.name)} <span class="count">${g.items.length}</span></h3><ul class="plist">${g.items.map(projectItem).join("")}</ul>${
          g.items.length > FOLD ? `<button type="button" class="showall" data-showall>Show all ${g.items.length} ${esc(g.name.toLowerCase())}</button>` : ""
        }</li>`,
    )
    .join("");

  const writes = writesIn(projects).slice(0, 5);
  const top = writes[0]?.pct || 1;
  const contact = `<ul class="contact">
<li><a class="btn primary" href="mailto:${esc(profile.links.email)}">Email ${esc(first)}</a></li>
${profile.links.resume ? `<li><a class="btn" href="${esc(profile.links.resume)}" target="_blank" rel="noopener">Résumé <span class="dim">PDF</span></a></li>` : ""}
<li><a class="btn" href="${esc(profile.links.github)}" rel="noopener" target="_blank">GitHub</a></li>
<li><a class="btn" href="${esc(profile.links.linkedin)}" rel="noopener" target="_blank">LinkedIn</a></li>
</ul>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>${esc(PAGE_TITLE)}</title>${SEO_HEAD}
<link rel="icon" type="image/png" href="/favicon.png" />
<meta name="theme-color" content="#030c0d" />
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="bar">
  <a class="site" href="/m" translate="no">${esc(profile.site)}</a>
  <nav aria-label="Sections"><a href="#projects">projects</a><a href="#ask">ask</a></nav>
</header>
<section class="hero" aria-label="Introduction">
  <canvas class="pond" aria-hidden="true"></canvas>
  <div class="hero-copy">
    <h1><span class="sr">${esc(profile.name)}</span>${bannerSvg()}</h1>
    <p class="role">${esc(profile.role)}${job ? ` at ${esc(job.org)}` : ""}</p>
    <p class="school">${esc(profile.studies.map((s) => s.school).join(" and "))}</p>
    ${contact}
  </div>
</section>
<main id="main">
<section id="now" aria-labelledby="now-h">
  <h2 id="now-h"><span aria-hidden="true">~/</span>now</h2>
  <dl class="kv">
    ${building ? `<dt>building</dt><dd>${esc(building.title)} <span class="dim">pushed ${ago(building.pushedAt)}</span></dd>` : ""}
    ${job ? `<dt>working</dt><dd>${esc(job.role)} <span class="dim">at ${esc(job.org)}</span></dd>` : ""}
    ${wins[0] ? `<dt>last win</dt><dd class="live">${esc(eventOf(wins[0]))}</dd>` : ""}
  </dl>
</section>
<section id="experience" aria-labelledby="exp-h">
  <h2 id="exp-h"><span aria-hidden="true">~/</span>experience <span class="count">${profile.work.length}</span></h2>
  <ol class="timeline">
    ${profile.work
      .map(
        (w) => `<li${w.to ? "" : ' class="current"'}><p class="when">${esc(w.from)} – ${w.to ? esc(w.to) : "now"}</p><p class="what">${esc(w.role)}</p><p class="where">${esc(w.org)}</p></li>`,
      )
      .join("")}
  </ol>
</section>
${
  profile.research.length
    ? `<section id="research" aria-labelledby="res-h">
  <h2 id="res-h"><span aria-hidden="true">~/</span>research <span class="count">${profile.research.length}</span></h2>
  <ul class="research">
    ${profile.research
      .map(
        (r) => `<li>
<p class="status${r.status.startsWith("Accepted") ? " accepted" : ""}">${esc(r.status)} <span class="dim">${esc(r.when)}</span></p>
<h3>${esc(r.title)}</h3>
<p class="detail">${esc(r.detail)}</p>
${r.url ? `<a class="out" href="${esc(r.url)}" rel="noopener" target="_blank">code<span aria-hidden="true"> ↗</span></a>` : ""}
</li>`,
      )
      .join("")}
  </ul>
</section>`
    : ""
}
<section id="wins" aria-labelledby="wins-h">
  <h2 id="wins-h"><span aria-hidden="true">~/</span>wins <span class="count">${wins.length}</span></h2>
  <ul class="wins">
    ${wins
      .map((h) => {
        // every row here is a win: the star says so, and only another placing ("2nd") is spelled out
        const place = placeOf(h.place);
        return `<li><span class="when">${esc(h.when)}</span><span class="place"><span class="star" aria-hidden="true">★</span>${place === "Winner" ? "" : ` ${esc(place)}`}</span><span class="event">${esc(eventOf(h))}</span></li>`;
      })
      .join("")}
  </ul>
</section>
<section id="projects" aria-labelledby="proj-h">
  <h2 id="proj-h"><span aria-hidden="true">~/</span>projects <span class="count">${projects.length}</span></h2>
  <div class="filters" role="group" aria-label="Show projects">${filters}</div>
  <ul class="groups">${projectGroups}</ul>
</section>
<section id="live" aria-labelledby="live-h">
  <h2 id="live-h"><span aria-hidden="true">~/</span>live</h2>
  <div class="gh" data-gh><p class="dim">GitHub stats load here.</p></div>
  <div class="music" data-music hidden></div>
</section>
<section id="ask" aria-labelledby="ask-h">
  <h2 id="ask-h"><span aria-hidden="true">~/</span>ask</h2>
  <p class="lede">Ask the assistant anything about ${esc(first)}'s ML work, projects, wins or stack.</p>
  <div class="thread" data-thread aria-live="polite"></div>
  <form class="askform" data-ask>
    <label class="sr" for="q">Your question</label>
    <input id="q" name="q" type="text" autocomplete="off" enterkeyhint="send" maxlength="2000" placeholder="What has he built in computer vision?" />
    <button type="submit">Ask</button>
  </form>
</section>
<section id="about" aria-labelledby="about-h">
  <h2 id="about-h"><span aria-hidden="true">~/</span>about</h2>
  <dl class="kv">
    ${profile.studies.map((s, i) => `<dt>${i ? "" : "studying"}</dt><dd>${esc(s.degree)} <span class="dim">${esc(s.school)}</span></dd>`).join("")}
    <dt>based</dt><dd>${esc(profile.based.join(" and "))}</dd>
    ${languages.length ? `<dt>speaks</dt><dd>${esc(languages.join(", "))}</dd>` : ""}
  </dl>
  <h3 class="sub">Writes in <span class="dim">by his commits</span></h3>
  <ul class="bars">
    ${writes.map((l) => `<li><span class="lang">${esc(l.name)}</span><span class="bar" style="--w:${((l.pct / top) * 100).toFixed(1)}%;--c:${techTag(l.name).col}"></span><span class="pct">${Math.round(l.pct)}%</span></li>`).join("")}
  </ul>
  ${contact}
</section>
</main>
<footer class="pagefoot">
  <p data-visits class="dim"></p>
  <button type="button" class="switch" data-switch>Open the laptop version</button>
  <p class="dim">The laptop version is a full terminal with keyboard shortcuts.</p>
</footer>
<script type="module" src="/m.js"></script>
</body>
</html>`;
}

const CSS = `
/* from the pond: green for what you can press, koi orange for what is live now, koi gold for
   the star on wins, ink and greys for the rest */
:root{--bg:#030c0d;--ink:#e9ece9;--muted:#8d9a92;--dim:#6f7d75;--line:#1c2925;--accent:#43f08a;--live:#ff8a3d;--star:#f2d36b;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Roboto Mono","Liberation Mono",monospace;color-scheme:dark}
*{box-sizing:border-box}
html{background:var(--bg);-webkit-text-size-adjust:100%;scroll-padding-top:56px}
body{margin:0;color:var(--ink);font:15px/1.6 var(--mono);touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.skip{position:absolute;left:12px;top:-60px;z-index:20;background:var(--accent);color:var(--bg);padding:8px 12px}
.skip:focus{top:12px}
.dim{color:var(--dim)}
.live{color:var(--live)}
.star{color:var(--star)}
.bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;
  height:calc(48px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 20px 0;background:rgba(3,12,13,.92);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.site{color:var(--ink);font-weight:600;text-decoration:none}
.bar nav{display:flex;gap:4px}
.bar nav a{color:var(--muted);text-decoration:none;padding:12px 10px;min-height:44px}
.hero{position:relative;min-height:min(82svh,620px);display:flex;align-items:flex-end;overflow:hidden;border-bottom:1px dashed var(--line);touch-action:pan-y}
.pond{position:absolute;inset:0;width:100%;height:100%}
.hero-copy{position:relative;width:100%;padding:96px 20px 28px;background:linear-gradient(to top,var(--bg) 62%,rgba(3,12,13,0))}
h1{margin:0}
.banner{display:block;width:100%;max-width:440px;height:auto}
.role{margin:18px 0 0;color:var(--accent);font-size:16px}
.school{margin:2px 0 0;color:var(--muted)}
.contact{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0 0;padding:0;list-style:none;max-width:440px}
.btn{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 16px;border:1px solid var(--line);color:var(--ink);text-decoration:none;border-radius:2px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--bg);font-weight:600}
main{padding:0 20px}
section{padding:36px 0 8px}
h2{display:flex;align-items:baseline;gap:10px;margin:0 0 18px;font-size:16px;font-weight:600;color:var(--ink)}
h2 span[aria-hidden]{color:var(--accent);margin-right:-10px}
h2::after{content:"";flex:1;order:1;border-top:1px dashed var(--line);transform:translateY(-4px)}
h2 .count{order:2}
.count{color:var(--dim);font-weight:400;font-variant-numeric:tabular-nums}
.kv{display:grid;grid-template-columns:7.5em 1fr;gap:6px 12px;margin:0}
.kv dt{color:var(--muted)}
.kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
.timeline{list-style:none;margin:0;padding:0 0 0 18px;border-left:1px solid var(--line)}
.timeline li{position:relative;padding:0 0 18px}
.timeline li::before{content:"";position:absolute;left:-23px;top:8px;width:9px;height:9px;background:var(--bg);border:1px solid var(--dim);border-radius:50%}
.timeline li.current::before{background:var(--live);border-color:var(--live)}
.current .when{color:var(--live)}
.timeline p{margin:0}
.when{color:var(--dim);font-size:13px;font-variant-numeric:tabular-nums}
.what{font-weight:600}
.where{color:var(--muted)}
.research{list-style:none;margin:0;padding:0}
.research li{padding:0 0 14px;margin-bottom:14px;border-bottom:1px dashed var(--line)}
.research .status{margin:0;font-size:13px;color:var(--muted)}
.research .status.accepted{color:var(--ink)}
.research h3{margin:2px 0 0;font-size:16px;font-weight:600}
.research .detail{margin:4px 0 0;color:var(--muted);font-size:14px}
.wins{list-style:none;margin:0;padding:0}
.wins li{display:grid;grid-template-columns:5.5em max-content 1fr;gap:12px;padding:10px 0;border-bottom:1px dashed var(--line)}
.wins .place{color:var(--ink)}
.wins .event{color:var(--muted);min-width:0}
.filters{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 12px;margin:0 -20px 4px;padding-left:20px;padding-right:20px;scrollbar-width:none;overscroll-behavior-x:contain}
.filters::-webkit-scrollbar{display:none}
.filters button{flex:none;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:2px;background:none;color:var(--muted);font:inherit;font-size:14px}
.filters button span{color:var(--dim);font-variant-numeric:tabular-nums}
.filters button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}
.groups,.plist{list-style:none;margin:0;padding:0}
.group h3{margin:20px 0 4px;font-size:13px;font-weight:400;color:var(--muted)}
.showall{display:none}
.js .project.more{display:none}
.js .group.open .project.more{display:list-item}
.js .showall{display:block;width:100%;min-height:44px;margin:4px 0 0;border:1px dashed var(--line);border-radius:2px;background:none;color:var(--muted);font:inherit;font-size:14px}
.js .group.open .showall{display:none}
.project{border-bottom:1px dashed var(--line)}
.project article{padding:14px 0}
.project .award{margin:0 0 2px;color:var(--ink);font-size:13px}
.project h4{margin:0;font-size:16px;font-weight:600}
.project .year{color:var(--dim);font-weight:400;font-size:13px;font-variant-numeric:tabular-nums}
.project .sum{margin:4px 0 8px;color:var(--muted);font-size:14px}
.project .foot{display:flex;align-items:center;justify-content:space-between;gap:12px}
.tags{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0;padding:0;list-style:none;font-size:12px}
.tags li{color:var(--c)}
.tags li::before{content:"● "}
.out{flex:none;font-size:14px;padding:10px 0;min-height:44px;display:inline-flex;align-items:center}
.gh .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0}
.gh .stats div{border:1px solid var(--line);padding:10px}
.gh dt{color:var(--dim);font-size:12px}
.gh dd{margin:0;font-size:20px;font-variant-numeric:tabular-nums}
.gh .pushed{margin:8px 0 0;font-size:13px}
.music{margin-top:20px}
.music h3{margin:0 0 6px;font-size:13px;font-weight:400;color:var(--muted)}
.music ol{list-style:none;margin:0;padding:0}
.music li a{display:flex;gap:8px;padding:8px 0;min-height:40px;color:var(--ink);text-decoration:none;border-bottom:1px dashed var(--line)}
.music li .by{color:var(--dim);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.music .t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none;max-width:60%}
.music .playing{color:var(--live)}
.lede{margin:0 0 12px;color:var(--muted)}
.thread{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
.thread p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.thread .you{color:var(--muted)}
.thread .you::before{content:"> ";color:var(--dim)}
.thread .bot::before{content:"⏺ ";color:var(--accent)}
.thread .err{color:#fda4af}
.askform{display:flex;gap:8px}
.askform input{flex:1;min-width:0;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:2px;background:#07171a;color:var(--ink);font:inherit;font-size:16px}
.askform input::placeholder{color:var(--dim)}
.askform button{min-height:44px;padding:0 18px;border:0;border-radius:2px;background:var(--accent);color:var(--bg);font:inherit;font-weight:600}
.askform button:disabled{opacity:.6}
.sub{margin:28px 0 8px;font-size:13px;font-weight:400;color:var(--muted)}
.bars{list-style:none;margin:0;padding:0}
.bars li{display:grid;grid-template-columns:7.5em 1fr 3em;align-items:center;gap:10px;padding:3px 0;font-size:14px}
.bars .lang{color:var(--muted)}
.bars .bar{height:8px;background:linear-gradient(var(--c),var(--c)) left/var(--w) 100% no-repeat}
.bars .pct{color:var(--dim);text-align:right;font-variant-numeric:tabular-nums}
.pagefoot{padding:40px 20px calc(40px + env(safe-area-inset-bottom));border-top:1px dashed var(--line);margin-top:40px}
.pagefoot p{margin:0 0 12px;font-size:13px}
.switch{min-height:44px;padding:0 16px;border:1px solid var(--accent);border-radius:2px;background:none;color:var(--accent);font:inherit;margin-bottom:8px}
@media (min-width:720px){main,.hero-copy,.pagefoot{max-width:720px;margin-left:auto;margin-right:auto}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
