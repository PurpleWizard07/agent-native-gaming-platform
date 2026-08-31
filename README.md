# Nightfall Arcade

**Live:** https://agent-native-gaming-platform.netlify.app

A gaming platform — store, library, friends, parties — designed for both
humans and agents. Players can describe the gaming experience they want, and
a WebMCP-enabled agent can operate the platform to turn that intent into a
playable session. The site is a fully working product on its own; WebMCP adds
a second mode of interaction on top of it, not a replacement for the first.

> This is a fictional gaming platform inspired by familiar digital game-store
> and social-gaming workflows. All users, libraries and friend data are
> synthetic; no real game is launched. The project demonstrates how such a
> platform can be made agent-operable through WebMCP.

Built for the WebMCP Challenge hackathon. Full design rationale:
[webmcp-gaming-platform-concept.md](./webmcp-gaming-platform-concept.md).
Build plan and phase-by-phase log: [implementation-plan.md](./implementation-plan.md).

---

## Why this is a strong fit for WebMCP

Almost every "AI gaming assistant" demo is a recommendation engine wearing a
chat window. This project's thesis is different: **the agent and the player
operate the same screen.** The agent handles the coordination — who's online,
who owns what, what fits tonight, who's invited — and the player keeps the
one moment that matters: pressing Launch.

Three of the twelve tools exist specifically because they live *in the page*,
not on a server — a plain remote MCP endpoint could never do this:

1. **`get_current_view`** reads what the player is actually looking at —
   the page, the filters they set by hand, the games currently on screen.
   A player can filter the Store themselves, then ask *"do any of these work
   for tonight?"* — no server-side agent has access to that state.
2. **`apply_filters`** and **`open_game`** drive the player's own screen, so
   the shortlist the agent reasoned about becomes visible instead of staying
   as chat text.
3. Those three tools are **registered only on the Store and Library pages** —
   open DevTools' WebMCP panel on Home and they're gone. The available tool
   set reflects where the player actually is, a property only in-page tools
   have.

## How it creates a better experience

Coordinating a group session today means: check who's online, check what
everyone owns, cross-reference player counts and session length, remember
who's already finished what, pick one, create a party, invite everyone, wait,
start. That's ten manual steps across four browser tabs and a group chat. One
sentence to the agent collapses that into a recommendation with a visible
reason — and the platform's own state (party, invites, "who's ready") changes
in response, not just a text answer.

## What's newly possible together

Before this, a player either browsed alone or asked a chatbot for
suggestions it couldn't act on. Here, a player can filter the Store by hand
and hand the *result* to the agent to reason over; the agent can create a
real party and send real invitations that land in a friend's own browser
session; and the platform is honest about failure — when no game satisfies
every constraint, the agent says so and names the closest option instead of
faking a perfect match. None of that is possible from a page an agent can
only search.

## How WebMCP is implemented

Every tool is registered with `document.modelContext.registerTool` through a
small hook ([`src/webmcp/useTool.ts`](./src/webmcp/useTool.ts)) that handles
registration/cleanup via `AbortController` and wraps each tool's return value
in the MCP content-array shape. Tools are grouped into three files by scope:

| File | Scope | Tools |
|---|---|---|
| [`src/webmcp/readTools.tsx`](./src/webmcp/readTools.tsx) | Global | `get_online_friends`, `get_my_library`, `get_friend_libraries`, `search_games`, `get_game_details` |
| [`src/webmcp/viewTools.tsx`](./src/webmcp/viewTools.tsx) | Store & Library only | `get_current_view`, `apply_filters`, `open_game` |
| [`src/webmcp/partyTools.tsx`](./src/webmcp/partyTools.tsx) | Global | `create_party`, `invite_friends`, `get_party_status`, `launch_session` |

Party tools call the exact same `PartyContext` methods the Party page's own
buttons use — the agent and the human are always driving one real, shared
state, never two parallel code paths. `search_games` and `apply_filters` both
resolve through the same [`filterGames`](./src/lib/filterGames.ts) function
the Store/Library pages render from, so an agent's answer and what the player
sees on screen can never silently disagree.

### The 12 tools

<details>
<summary>Full tool reference (names, descriptions, inputs)</summary>

**Read — registered globally**

- `get_online_friends()` — friends with presence and what each is playing right now.
- `get_my_library({ onlyUnfinished?, onlyInstalled? })` — the signed-in player's owned games with playtime/completion/install state.
- `get_friend_libraries({ friendIds })` — ownership + completion for named friends.
- `search_games({ query?, genres?, minPlayers?, coop?, maxSessionMinutes? })` — catalog search by hard constraints.
- `get_game_details({ gameIds })` — full detail per game, including which friends own it.

**Page context — registered only on Store and Library**

- `get_current_view()` — current page, hand-set filters, and games visible on screen right now.
- `apply_filters({ genres?, minPlayers?, coop?, maxSessionMinutes?, onlyUnfinished?, onlyInstalled?, clear? })` — sets the filters on the page the player is looking at.
- `open_game({ gameId })` — navigates the player's screen to a game's page.

**Party — registered globally**

- `create_party({ gameId })` — starts a session with the signed-in player as host.
- `invite_friends({ friendIds })` — invites friends; the invite appears in their own browser session.
- `get_party_status()` — current party, member states, and whether it's ready to launch.
- `launch_session()` — starts the session once every invited member has accepted.

</details>

---

## Try it yourself

Open the [live site](https://agent-native-gaming-platform.netlify.app) in
ChatGPT's in-app browser, or in Chrome with
`chrome://flags/#enable-webmcp-testing` enabled, and try:

- *"Alex, Sam and Maya are online. We've got about 75 minutes. Find a co-op
  game all four of us can play, preferably something none of us has
  finished."* — the hero flow. Answer: **Nightfall Signal**, with **Ridge
  Runners** as the honest near-miss (Sam's already finished it).
- *"Let's play."* — the agent creates the party and invites everyone.
- *"Find me something solo under 30 minutes."*
- *"What's in my library I've never started?"*
- *"Alex is playing something right now — would that work for all four of us?"*

### Seeing the real invite flow

Invites are not simulated — they go through a real backend
([`netlify/functions/party.ts`](./netlify/functions/party.ts), backed by
Netlify Blobs) and land in the recipient's own browser session. To see it:

1. Open the site in one window, play as **Purple** (the default), and start a
   party from any game page.
2. Open a **second window** (or an incognito window — the "View as" viewer
   choice is stored per-tab), switch **View as** to **Alex**, and go to
   **Party**. The invite is there for real, not on a timer.
3. Accept as Alex; watch Purple's window pick it up within ~2 seconds via
   polling, with no manual refresh.

A **Reset demo** link at the bottom of the Party page clears the shared state
for the next person.

---

## Architecture

- **Vite + React + TypeScript**, Tailwind v4, `react-router-dom`.
- All game/user/library data is static, bundled TypeScript (`src/data/`) —
  deterministic, no external APIs, no auth, no flake. Seed data is
  purpose-built so the hero query resolves to exactly one clean answer plus
  one legible near-miss; `npm run check-funnel` re-verifies this.
- The only mutable, shared state is the current party, held in **Netlify
  Blobs** behind one Netlify Function (`/api/party`) — no database.
- Game covers are procedurally generated (a per-game gradient + typography,
  [`src/components/GameCover.tsx`](./src/components/GameCover.tsx)) — no
  copied or licensed storefront artwork.

## Running locally

```bash
npm install
npx playwright install chromium   # only needed for the verification scripts below
netlify dev                       # serves the site AND the /api/party function together
```

`npm run dev` (plain Vite) also works for UI-only work, but the party service
and the tool layer need `netlify dev` since they depend on `/api/party`.

## Verification

This project leans on scripted browser verification rather than manual
click-through, since a hackathon deadline is exactly when regressions slip
in:

| Command | What it checks |
|---|---|
| `npm run check-funnel` | The hero-query dataset resolves to exactly one answer + one near-miss (pure data, no browser) |
| `npm run test:ui` | Every page renders without console errors, at desktop and 390px widths |
| `npm run test:party` | Two independent browser sessions (Purple + Alex) exchange a real invite through the live backend |
| `npm run test:webmcp` | The 12 tools' registration and `execute()` logic, via a shimmed `document.modelContext` |
| `npm run test:evals` | [`evals/webmcp-evals.json`](./evals/webmcp-evals.json) run with [`webmcp-evals smoke`](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/webmcp-evals) against **real Chrome** — no shim, no LLM/API key needed |

`test:party`, `test:webmcp`, and `test:evals` need `netlify dev` running in
another terminal first (`test:evals` targets `http://localhost:8888/store`
by default — edit the script in `package.json` to point at the live URL
instead).

## License

MIT — see [LICENSE](./LICENSE).
