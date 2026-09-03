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

Four of the thirteen tools exist specifically because they live *in the page*,
not on a server — a plain remote MCP endpoint could never do this:

1. **`get_current_view`** reads what the player is actually looking at —
   the page, the filters they set by hand, the games currently on screen.
   A player can filter the Store themselves, then ask *"do any of these work
   for tonight?"* — no server-side agent has access to that state.
2. **`apply_filters`** and **`open_game`** drive the player's own screen, so
   the shortlist the agent reasoned about becomes visible instead of staying
   as chat text.
3. **The registered tool set changes with the player's context.** Open
   DevTools' WebMCP panel on Home and the page-context tools are gone.
   `apply_filters` appears only where there are filters to set (Store,
   Library); `get_current_view` and `open_game` also appear on a game page,
   where "this game" has an answer. Nine tools on Home, twelve on the Store.
4. **`respond_to_invite`** is registered only while an invitation is actually
   pending, and only in the *invited* player's session — so Alex's agent can
   answer on Alex's behalf. Its mere presence tells an agent there is
   something to respond to, and it makes the flow agent-to-agent coordination
   through a shared platform rather than one agent driving one screen.

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
| [`src/webmcp/viewTools.tsx`](./src/webmcp/viewTools.tsx) | Store, Library & game pages | `get_current_view`, `open_game` |
| [`src/webmcp/viewTools.tsx`](./src/webmcp/viewTools.tsx) | Store & Library only | `apply_filters` |
| [`src/webmcp/partyTools.tsx`](./src/webmcp/partyTools.tsx) | Global | `create_party`, `invite_friends`, `get_party_status`, `launch_session` |
| [`src/webmcp/partyTools.tsx`](./src/webmcp/partyTools.tsx) | Only while an invite is pending | `respond_to_invite` |

Party tools call the exact same `PartyContext` methods the Party page's own
buttons use — the agent and the human are always driving one real, shared
state, never two parallel code paths. `search_games` and `apply_filters` both
resolve through the same [`filterGames`](./src/lib/filterGames.ts) function
the Store/Library pages render from, so an agent's answer and what the player
sees on screen can never silently disagree.

Three smaller details that matter in practice:

- **Every tool the agent can reach, the player can reach too.** The Store and
  Library have a search box because `search_games` takes a `query`, and a
  "Never started" toggle because `get_my_library` takes `onlyUnplayed`. Where
  the two sets diverged, the UI was the half that was missing.
- **Read tools declare `annotations: { readOnlyHint: true }`**, so a host can
  auto-approve the seven that only look and prompt for the six that change
  something. Without it, "check who's online" and "launch the session" look
  identical to an agent host.
- **Tool failures come back as data.** `useTool` catches throws and returns
  `{ error: "no active party" }` with `isError: true`; an agent that reads
  that recovers by calling `create_party`, where an opaque host-level failure
  just stops it. `launch_session` goes further and names who it is waiting on.

### The 13 tools

<details>
<summary>Full tool reference (names, descriptions, inputs)</summary>

**Read — registered globally**

- `get_online_friends()` — friends with presence and what each is playing right now.
- `get_my_library({ onlyUnfinished?, onlyUnplayed?, onlyInstalled? })` — the signed-in player's owned games with playtime/completion/install state. `onlyUnfinished` includes games in progress; `onlyUnplayed` is strictly "never started".
- `get_friend_libraries({ friendIds })` — ownership + completion for named friends.
- `search_games({ query?, genres?, minPlayers?, coop?, maxSessionMinutes? })` — catalog search by hard constraints. `query` matches title and genre; `maxSessionMinutes` is a *budget*, not a floor (see below).
- `get_game_details({ gameIds })` — full detail per game, including which friends own it.

**Page context — registered only where the player can act on them**

- `get_current_view()` — *Store, Library, game pages.* On a list page: the page, the hand-set filters, and the games visible on screen right now. On a game page: the game in focus. The payload is shaped per page rather than one union of every field, so a game page can't report the stale list from the page before it.
- `open_game({ gameId })` — *Store, Library, game pages.* Navigates the player's screen to a game's page.
- `apply_filters({ query?, genres?, minPlayers?, coop?, maxSessionMinutes?, onlyUnfinished?, onlyUnplayed?, onlyInstalled?, clear? })` — *Store and Library only.* Sets the filters on the page the player is looking at.

**Party — registered globally**

- `create_party({ gameId })` — starts a session with the signed-in player as host.
- `invite_friends({ friendIds })` — invites friends; the invite appears in their own browser session. Re-inviting someone who declined resets them to invited.
- `get_party_status()` — current party, member states, and whether it's ready to launch.
- `launch_session()` — starts the session once every invited member has **responded**; anyone who declined is left behind rather than blocking the launch. Returns `{ status: "not_ready", waitingOn: [...] }` naming who hasn't answered.

**Party — registered only while an invitation is pending**

- `respond_to_invite({ accept? })` — accepts or declines the invitation waiting for the signed-in player. Present only when there is something to respond to.

</details>

### What "fits about 75 minutes" means

`maxSessionMinutes` is a session *budget*. A game fits when its shortest
session is within the budget **and** its longest overruns it by no more than
30% — so a 45-70 min game fits a 60-minute evening and a 60-120 min game does
not, even though it *can* be played in 60. That single rule
([`SESSION_OVERRUN_FACTOR`](./src/lib/filterGames.ts)) is imported by the
Store/Library filters, `search_games`, `apply_filters` and
`npm run check-funnel` alike, so the product and the dataset check cannot
drift apart on it. The UI labels its presets "About 30 min", "About 60 min"
for the same reason — "Under 60 min" would be a claim the filter does not
make.

---

## Try it yourself

Open the [live site](https://agent-native-gaming-platform.netlify.app) in
ChatGPT's in-app browser, or in Chrome with
`chrome://flags/#enable-webmcp-testing` enabled, and try:

- *"Alex, Sam and Maya are online. We've got about 75 minutes. Find a co-op
  game all four of us can play — preferably something none of us has finished,
  and nothing scary."* — the hero flow. Answer: **Nightfall Signal**, with
  **Ridge Runners** as the honest near-miss (Sam's already finished it).
- *"Let's play."* — the agent creates the party and invites everyone.
- *"Find me something solo under 30 minutes."*
- *"What's in my library I've never started?"*
- *"Alex is playing something right now — would that work for all four of us?"*

Every clause of that hero prompt does real work, and `npm run check-funnel`
prints the funnel one clause at a time to prove it. That includes *"nothing
scary"*: without it, **Hollow Choir** and **Fathom Line** satisfy the request
just as well as Nightfall Signal, and an agent naming either would be right.
An earlier version of the prompt left the preference out while the dataset
check quietly applied it anyway — so the demo claimed a unique answer it had
not actually earned.

### Seeing the real invite flow

Invites are not simulated — they go through a real backend
([`netlify/functions/party.ts`](./netlify/functions/party.ts), backed by
Netlify Blobs) and land in the recipient's own browser session. To see it:

1. Open the site in one window, play as **Purple** (the default), and start a
   party from any game page.
2. Open a **second window**, switch **View as** to **Alex**, and go to
   **Party**. The invite is there for real, not on a timer.
3. Accept as Alex; watch Purple's window pick it up within ~2 seconds via
   polling, with no manual refresh.

A second window in the same browser joins automatically. For an **incognito
window or a different browser**, use the **Copy** button under "Second player"
on the Party page and open that link — it carries the room id.

A **Reset demo** link at the bottom of the Party page clears the state for
your room.

### Parties are namespaced per room

Each visitor gets their own party. The room id comes from `?room=` in the URL
if present, then `localStorage`, then a fresh random id, and is written back
into the address bar so the URL is a shareable invite link. Without this the
service held exactly one global party, so two people trying the live site at
the same time silently clobbered each other's session — the failure mode most
likely to hit a demo that several people open at once.

---

## Architecture

- **Vite + React + TypeScript**, Tailwind v4, `react-router-dom`.
- All game/user/library data is static, bundled TypeScript (`src/data/`) —
  deterministic, no external APIs, no auth, no flake. Seed data is
  purpose-built so the hero query resolves to exactly one clean answer plus
  one legible near-miss; `npm run check-funnel` re-verifies this, printing the
  funnel one prompt clause at a time.
- Generated library entries are internally consistent: a null `lastPlayedAt`
  means never launched, so playtime is 0 and `completed` is false. Generating
  those fields independently produced entries claiming 300 minutes played on a
  game that had never been started — and made *"what have I never started?"*
  a question with no possible answer.
- The only mutable, shared state is the current party, held in **Netlify
  Blobs** behind one Netlify Function (`/api/party`), namespaced per room —
  no database.
- **Agent actions announce themselves.** When the agent applies filters or
  assembles a party, the page changes the way a page changes, but it also
  raises a short toast. In a narrow viewport — ChatGPT's in-app browser — a
  quiet state change three sections down is easy to miss, and a player who
  cannot see what the agent did cannot supervise it.
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
| `npm run test:ui` | Every page renders without console errors at 1280px |
| `npm run test:mobile` | Store and Home render without console errors at 390px |
| `npm run test:party` | Two independent browser sessions (Purple + Alex) exchange a real invite through the live backend; a third in another room sees none of it. Neither page installs a WebMCP shim, so this is also the check that an ordinary browser with no agent stays error-free |
| `npm run test:webmcp` | All 13 tools' registration and `execute()` logic via a shimmed `document.modelContext` — per-page and per-state registration, read-only annotations, structured errors, and registration after a **late-injected** `document.modelContext` |
| `npm run test:view` | `get_current_view` matches the rendered DOM on a fresh page load, after a hand-set filter, and across navigation — the hero demo's first beat |
| `npm run test:evals` | [`evals/webmcp-evals.json`](./evals/webmcp-evals.json) run with [`webmcp-evals smoke`](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/webmcp-evals) against **real Chrome** — no shim, no LLM/API key needed |

`test:party`, `test:webmcp`, and `test:evals` need `netlify dev` running in
another terminal first (`test:evals` targets `http://localhost:8888/store`
by default — edit the script in `package.json` to point at the live URL
instead).

## License

MIT — see [LICENSE](./LICENSE).
