# arhaansh.me

The portfolio of Arhaansh Jhingan (Quant ML Developer at Mintzy, BTech CSE at VIT Vellore, BS Data Science & Applications at IIT Madras), rendered as a terminal app.

It is a fork of [xiao.sh](https://github.com/i098/xiao.sh) by Jerry Xiao, used under the Apache License 2.0; see [NOTICE](NOTICE).
The engine is unchanged: one [OpenTUI](https://github.com/anomalyco/opentui) + React tree, reachable over SSH or in a browser, with the koi pond, the boot log, live GitHub stats, a Spotify widget and an AI chat.
What changed is the content and the parts that describe it: profile, wins, experience, and ML-first project labels.

## Screens

- Home: visitor count with a 14-day chart, live GitHub pulse (commits, contributions, stars, last push), Spotify recently played.
- Projects: every public repo on [github.com/XArhaanshX](https://github.com/XArhaanshX), labelled by rule (`src/lib/project-labels.ts`) into Computer vision, Time series, NLP & agents, Quant ML, Research, Classical ML and Systems, with wins first.
- About: name banner, what he is building and where he works now, studies, experience, hackathon wins, languages spoken, and the languages he writes in, weighted by his commits.
- Chat: an AI that answers questions about him from the same data (OpenRouter free models).

Keys: `h` home, `p` projects, `a` about, `c` chat, `q` quit; `←`/`→` cycle screens.

## Quickstart

Requires [Bun](https://bun.sh).

```bash
bun install
bun run web     # browser terminal on http://localhost:8787
bun run tui     # run the TUI in your own terminal
bun run start   # web (:8787) + ssh (:2222)
bun test
```

Everything runs without configuration; copy `.env.example` to `.env` to switch on the rest:

- `GITHUB_TOKEN`: raises the GitHub rate limit for the home-screen pulse, and is required by `bun run sync:projects` and the daily project refresh.
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`: the recently-played widget. Get the refresh token with `bun run spotify:auth` (register `http://127.0.0.1:8888/callback` as a redirect URI in the Spotify app first).
- `OPENROUTER_API_KEY`: the chat screen.

## What updates on its own

- GitHub pulse (home): fetched live, cached 10 minutes.
- Projects, "building" and "writes in": re-derived from GitHub by the daily cron on Cloudflare (needs `GITHUB_TOKEN` as a Worker secret), so new repos appear without a redeploy. Locally, `bun run sync:projects` rewrites the committed snapshot `src/data/projects.json`.
- Visitors: counted per visit, stored in `.data/` locally or KV on Cloudflare.
- Spotify: polled live once the Spotify secrets are set.

Wins, experience and languages come from `src/data/linkedin-about.json` and `src/lib/profile.ts`; edit them by hand (or run `bun run sync:linkedin`) and redeploy.

## Editing content

- Profile, studies, work, links, site name: `src/lib/profile.ts`.
- Wins, languages, LinkedIn context for the AI: `src/data/linkedin-about.json`. Wins are the `Honors & Awards` items that mention a hackathon or CTF, written as `Event Place by Organiser Mon YYYY`.
- A wrong project label, title or summary: one line in `src/data/project-overrides.ts`.

## Deploy (Cloudflare Workers)

```bash
bunx wrangler kv namespace create DATA        # paste the id into wrangler.jsonc
bunx wrangler secret put GITHUB_TOKEN         # and SPOTIFY_*, OPENROUTER_API_KEY
CLOUDFLARE_ACCOUNT_ID=... bun run deploy:cf
```

It serves on `arhaansh-me.<account>.workers.dev`; add a custom domain under `routes` in `wrangler.jsonc` and set `PUBLIC_ORIGIN` to it.

## License

Apache License 2.0, as the original. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
