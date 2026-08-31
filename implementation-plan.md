# Implementation Plan

Design of record: [webmcp-gaming-platform-concept.md](webmcp-gaming-platform-concept.md).

> **Status: Phases 0–6 complete.** Live at
> https://agent-native-gaming-platform.netlify.app. Remaining before
> submission: record the demo video (shot list in
> [SUBMISSION.md](SUBMISSION.md)), and a live Chrome/ChatGPT in-app browser
> click-through as a final human check — everything else, including the
> tool layer, has been verified by script (see README's Verification table).

**Principles for this build**

1. **Deploy on day one.** A live Netlify URL with a placeholder page, before any
   feature work. Never discover a deploy problem at the end.
2. **Every phase ends deployable.** No phase leaves the site broken.
3. **Simplest thing that works.** No database, no auth, no state library, no
   websockets, no CMS. One function, one blob.
4. **Cut before adding.** If a phase runs long, drop scope from Phase 6 — not
   from Phases 3–5.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + React + TypeScript | Fast, Netlify-native. TS pays for itself on tool schemas. |
| Routing | react-router-dom | Six pages, nothing more needed. |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | Polished UI quickly; one line of config. |
| Client state | React context + `fetch` polling | No Redux, no react-query. Party polls every 1.5s. |
| Static data | Typed TS modules bundled in the client | Zero network, zero failure modes. |
| Shared state | One Netlify Function + Netlify Blobs | No DB, nothing to provision. |
| WebMCP | `document.modelContext.registerTool` via a thin `useTool` hook | ~20 lines, full control over cleanup. |

`use-webmcp-tool` from npm is a fine alternative to the hand-rolled hook. Decide
in Phase 4 after reading the spec, then stop thinking about it.

---

## File layout

```
netlify.toml
package.json
LICENSE                          MIT, root, detectable
README.md                        pitch + disclaimer + run instructions
index.html
src/
  main.tsx  App.tsx  styles.css
  data/       games.ts  users.ts  libraries.ts
  state/      SessionContext.tsx  ViewContext.tsx  useParty.ts
  webmcp/     useTool.ts  readTools.ts  viewTools.ts  partyTools.ts
  pages/      Home  Store  Library  Friends  Game  Party
  components/ Nav  GameCard  FilterBar  MemberRow  Toast  UserSwitcher
netlify/functions/
  party.ts
evals/
  webmcp-evals.json
public/covers/                   generated cover art
```

---

## Phase 0 — Scaffold and first deploy

**Goal:** a live HTTPS URL, and certainty about the WebMCP API surface.

- `npm create vite@latest` → React + TS. Add Tailwind and react-router.
- `netlify.toml`:
  ```toml
  [build]
    command = "npm run build"
    publish = "dist"
    functions = "netlify/functions"

  [[redirects]]
    from = "/api/*"
    to = "/.netlify/functions/:splat"
    status = 200

  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```
- Push to GitHub, connect Netlify, confirm the URL loads.
- Add `LICENSE` (MIT) now, so it's detectable from the first commit.
- **Verify the spec, don't assume it.** Read the
  [WebMCP explainer](https://github.com/webmachinelearning/webmcp) and
  [Chrome's docs](https://developer.chrome.com/docs/ai/webmcp), and pin down
  exactly: the `registerTool` signature, how a tool is *unregistered*, and the
  expected return shape of `execute`. Register one throwaway `ping` tool and
  confirm it appears in Chrome DevTools with
  `chrome://flags/#enable-webmcp-testing` enabled. Everything in Phase 4 depends
  on getting this right once.

**Done when:** the Netlify URL is live and `ping` is visible in DevTools.
**Size:** half a day.

---

## Phase 1 — Seed data and the reasoning funnel

**Goal:** data that makes the hero query resolve to exactly one answer plus one
near-miss.

- `data/games.ts` — ~24 games, original titles. Each with genres, `minPlayers`,
  `maxPlayers`, `coopModes`, `sessionMinutes {min,max}`, description, cover path.
- `data/users.ts` — Purple (signed in), Alex, Sam, Maya online, Chris offline,
  each with `playingGameId`.
- `data/libraries.ts` — ownership, playtime, `completed`, `installed`,
  `lastPlayedAt` per user.
- **Work backwards from the funnel in concept §7.** Write a throwaway script or
  test that runs the hero constraints over the seed data and asserts: exactly one
  perfect match, exactly one near-miss. Tune the data until it does.
- Generate 24 covers in one batch, commit to `public/covers/`, note prompts and
  licensing in the README. If art runs long, fall back to a procedural
  `<GameCover>` component — strong typography on a per-game gradient. Do not
  spend a second day on art.

**Done when:** the funnel assertion passes and every game has a cover.
**Size:** one day.

---

## Phase 2 — The human website (5 pages)

**Goal:** a site that stands on its own, with zero WebMCP. This is the
*Execution* score.

- `Nav` + routing + `UserSwitcher` ("View as: Purple / Alex / Sam / Maya").
- **Home** — greeting, Continue Playing, Friends Online, recommended row.
- **Store** — grid + `FilterBar` (genre, player count, co-op, session length).
- **Library** — grid + filters (unplayed / in progress / completed / installed).
- **Game** — detail page, friends-who-own, Play button.
- **Friends** — presence list with what each friend is playing.
- `ViewContext` holds the current page, active filters and visible game ids.
  **Build it now, not in Phase 4** — the page-context tools read straight from it,
  and retrofitting it later is the one predictable source of rework.
- Responsive, and sanity-checked at ~390px wide: the ChatGPT in-app browser is
  narrow, and that is where judges will see it.

**Done when:** all five pages are browsable and look like a real product at
desktop and phone widths.
**Size:** two days. The biggest phase — protect its time.

---

## Phase 3 — Party service and the real second player

**Goal:** an invite that genuinely crosses between two browser windows. The one
piece of backend in the project.

- `netlify/functions/party.ts` — single handler over one Netlify Blobs key:
  - `GET /api/party` → current party or `null`
  - `POST /api/party` with `{ action }`:
    `create` · `invite` · `respond` · `launch` · `reset`
  - Recompute `status` on every write: `forming` → `ready` once all members have
    accepted → `launching` → `launched`.
  - Last-write-wins is fine. Do not add locking.
- `useParty.ts` — fetch + 1.5s polling, exposed through context.
- **Party page** — game header, member rows with state, Launch button disabled
  until `readyToLaunch`.
- Invite badge in `Nav`, plus a `Toast` when an invite arrives for the current
  viewer.
- **Reset demo** control in the footer, calling `reset`. Judges must be able to
  start clean.

**The test that matters:** two windows side by side, Purple and Alex. Purple
invites; the invite appears in Alex's window within ~2s; Alex accepts; Purple's
member row flips to Accepted; Launch enables.

**Done when:** that two-window test passes on the deployed Netlify URL, not just
locally.
**Size:** one day.

---

## Phase 4 — The WebMCP layer (12 tools)

**Goal:** every tool in concept §8 registered, well described, and working.

- `webmcp/useTool.ts` — thin hook wrapping `registerTool`, using whatever
  registration and cleanup API Phase 0 confirmed. Guard on
  `'modelContext' in document` so the site works fine in browsers without it.
- `readTools.ts` — `get_online_friends`, `get_my_library`,
  `get_friend_libraries`, `search_games`, `get_game_details`. Registered app-wide.
- `viewTools.ts` — `get_current_view`, `apply_filters`, `open_game`. Registered
  **only** on Store and Library, reading and writing `ViewContext`. Confirm in
  DevTools that they disappear on Home — the contextual tool set is part of the
  pitch.
- `partyTools.ts` — `create_party`, `invite_friends`, `get_party_status`,
  `launch_session`. These call the same `/api/party` endpoint the UI uses; no
  parallel code path.
- Copy the descriptions from concept §8 **verbatim**. They were written to
  disambiguate siblings, and they are what a judge reads in the repo. Every tool
  returns compact structured JSON — no prose blobs, no nulls where an empty array
  belongs.

**Done when:** all 12 appear in DevTools, and the full hero flow runs end-to-end
from a single prompt in Chrome.
**Size:** one to one and a half days.

---

## Phase 5 — Tuning, evals, and the near-miss

**Goal:** the agent behaves well on prompts nobody scripted.

- Run the hero prompt ten times. Watch for: tools called in a silly order, the
  agent ignoring `get_current_view` and re-searching from scratch, over-calling
  `get_game_details`. Fix by **editing descriptions**, not by adding tools.
- Tune the near-miss until the agent reliably names both the pick and the close
  option, with reasons. The most persuasive moment in the demo.
- Test the exploration prompts in concept §11 and the "no perfect match" path.
- Write `evals/webmcp-evals.json` using
  [WebMCP Evals](https://developer.chrome.com/docs/ai/webmcp/evals) — a handful of
  cases over the hero flow plus two solo queries. Few submissions will ship evals;
  it is cheap evidence of real engineering.
- Test in **ChatGPT's in-app browser**, not only Chrome. Budget real time here —
  it is the judging surface and the likeliest place to find a surprise.

**Done when:** the hero flow succeeds from a cold prompt in the ChatGPT in-app
browser, and the evals pass.
**Size:** one day.

---

## Phase 6 — Submission package

- **README** — the §2 pitch, the §13 disclaimer, the 12 tools with their
  descriptions, local-run instructions, two-window demo instructions, cover-art
  provenance.
- **License** — in place since Phase 0. Confirm it shows in the GitHub About
  panel.
- **Demo video** (< 3 min, public YouTube, clear audio). Shot list:
  1. 0:00–0:20 — the site, browsed by hand. It's a real product.
  2. 0:20–0:35 — filter the Store by hand. *Beat 1.*
  3. 0:35–1:20 — the prompt; the agent reads the view, checks libraries, answers
     with the pick **and the near-miss**.
  4. 1:20–2:10 — party created, invite lands in the second window, Alex accepts,
     **the human clicks Launch**. Both windows visible at once.
  5. 2:10–2:40 — DevTools showing the registered tools, and the page-context tools
     appearing only on Store.
  6. 2:40–3:00 — the one-line thesis.
- **Text description** — answer the brief's four prompts directly, using concept
  §4 as the answer to "why WebMCP".

**Size:** half a day. Don't leave the video to the final hour; a re-record is
always needed.

---

## Sequencing and slack

```
P0 scaffold + deploy   ▓             0.5d
P1 data + funnel        ▓▓           1d
P2 website                ▓▓▓▓       2d
P3 party service              ▓▓     1d
P4 WebMCP tools                 ▓▓▓  1.5d
P5 tuning + evals                  ▓▓ 1d
P6 submission                        ▓ 0.5d
                                     ─────
                                     7.5d
```

Sizes are relative, not calendar dates — scale them to the actual deadline. If
time compresses, cut in this order: the stretch 13th tool, then the evals, then
Library filters (keep Store's), then cover art (use the procedural fallback).
**Never** compress Phase 2 or the two-window test in Phase 3 — they are the
credibility of the whole thing.

---

## Risks

| Risk | Mitigation |
|---|---|
| WebMCP registration API differs from assumption | Phase 0 verifies against the spec before any tool is written |
| ChatGPT in-app browser behaves differently from Chrome | Test there in Phase 5, with real time budgeted, not at the end |
| Agent skips `get_current_view` and re-searches | Description tuning in Phase 5; that is explicitly the fix |
| Cover art eats a day | Hard cap of one batch; procedural fallback ready |
| Netlify Blobs cold start makes invites feel slow | 1.5s polling plus an optimistic local update on the acting client |
| A judge lands on a party left mid-flow by the previous judge | Reset demo control, built in Phase 3 |
