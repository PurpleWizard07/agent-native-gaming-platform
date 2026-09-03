# Captain Claw

**Live:** https://captainclaw.netlify.app

A gaming platform with a store, library, friends list, and party sessions.

Captain Claw works like a normal gaming site on its own. It also exposes 13
WebMCP tools that let an agent work with the same product: check libraries,
use the current Store view, create parties, and send invitations.

The agent handles the coordination. You still decide what to play and press
Launch.

> A fictional platform built for the WebMCP Challenge hackathon. Users,
> libraries, friends, and game data are synthetic. No real game is launched.

---

## The problem it actually solves

Four friends want to play for about an hour.

You need to check who's online, see what everyone owns, find games that
support the right number of players, remember what people have already
played, pick a game, create a party, invite everyone, and wait for replies.

None of these steps is especially difficult. The problem is that the answer
depends on several people's state at the same time.

With Captain Claw, the player can describe the whole request in one message.
The agent finds a match and can then create the party and send the
invitations.

This changes the actual platform state. It is not just a recommendation in
chat.

## Why this needs WebMCP and not a remote MCP server

A normal gaming assistant could expose a server API and stop there. Captain
Claw needs browser context too.

Four of the 13 tools specifically depend on what the player is doing in the
browser.

**`get_current_view` reads the page the player is currently on.** It can see
which page is open, which filters the player selected, and which games are
visible.

For example, the player can filter the Store first and then ask the agent,
"Do any of these work for tonight?" The agent can use the actual Store view
instead of guessing.

**`apply_filters` and `open_game` can change that same view.** When the agent
finds a shortlist, it can apply the filters or open the game on the page the
player is already using.

**The available tools also change with the page and state.** `apply_filters`
is only available on Store and Library pages. `get_current_view` and
`open_game` are also available on game pages. `respond_to_invite` only
appears when the signed-in player actually has a pending invitation, in that
player's own session.

That means the agent discovers capabilities from the current state of the
product instead of getting one large list of unrelated tools.

## What you can do here that you couldn't before

The useful difference is that the agent can work with live product state, not
just return recommendations.

A player can give the agent a manually filtered Store and ask it to evaluate
those games. The agent can create a real party and send invitations to other
users' sessions. When no game matches every constraint, it can explain the
closest match and what prevented it from fitting.

The agent is also taking actions, so being vague is much less useful. A wrong
recommendation here can create a party and send three invitations.

## How the WebMCP layer is built

The WebMCP integration is kept in one small hook,
[`src/webmcp/useTool.ts`](./src/webmcp/useTool.ts).

Each tool is registered with `document.modelContext.registerTool`. The hook
handles registration, cleanup with `AbortController`, and the standard MCP
content-array response shape.

The tools are grouped by scope:

| File | Registered | Tools |
|---|---|---|
| [`readTools.tsx`](./src/webmcp/readTools.tsx) | everywhere | `get_online_friends`, `get_my_library`, `get_friend_libraries`, `search_games`, `get_game_details` |
| [`viewTools.tsx`](./src/webmcp/viewTools.tsx) | Store, Library, game pages | `get_current_view`, `open_game` |
| [`viewTools.tsx`](./src/webmcp/viewTools.tsx) | Store and Library only | `apply_filters` |
| [`partyTools.tsx`](./src/webmcp/partyTools.tsx) | everywhere | `create_party`, `invite_friends`, `get_party_status`, `launch_session` |
| [`partyTools.tsx`](./src/webmcp/partyTools.tsx) | only while an invite is pending | `respond_to_invite` |

The tools use the same functions as the normal UI. Party tools call the same
`PartyContext` methods used by the Party page, and search/filtering use the
same [`filterGames`](./src/lib/filterGames.ts) function as the Store and
Library.

There is no separate agent-only implementation of the product.

### A few important implementation choices

**The agent uses the same capabilities as the UI.** Anything the agent can do
is also possible through the normal product. The Store has search and
filters, and the Library has the same states exposed through the tools.

**Read-only tools are marked as read-only.** The seven read tools use
`annotations: { readOnlyHint: true }`, so a host can distinguish them from
tools that change state.

**Tool failures are returned as structured data.** For example,
`get_party_status` can return `no active party` instead of failing opaquely.
The agent can then recover by creating a party.

### The 13 tools

<details>
<summary>Full reference: names, inputs, behaviour</summary>

**Read (global)**

- `get_online_friends()` — friends with presence and what each is playing right now.
- `get_my_library({ onlyUnfinished?, onlyUnplayed?, onlyInstalled? })` — owned games with playtime, completion and install state. `onlyUnfinished` includes games in progress; `onlyUnplayed` is strictly "never started".
- `get_friend_libraries({ friendIds })` — ownership and completion for named friends.
- `search_games({ query?, genres?, minPlayers?, coop?, maxSessionMinutes? })` — catalog search on hard constraints. `query` matches title and genre. `maxSessionMinutes` is a budget, not a floor (see below).
- `get_game_details({ gameIds })` — full detail per game, including which friends own it.

**Page context (only where the player can act on them)**

- `get_current_view()` — Store, Library, game pages. On a list page: the page, the hand-set filters, and what's on screen. On a game page: the game in focus. The payload is shaped per page rather than as one union of every field.
- `open_game({ gameId })` — Store, Library, game pages. Navigates the player's screen.
- `apply_filters({ query?, genres?, minPlayers?, coop?, maxSessionMinutes?, onlyUnfinished?, onlyUnplayed?, onlyInstalled?, clear? })` — Store and Library only. Sets the filters on the page the player is looking at.

**Party (global)**

- `create_party({ gameId })` — starts a session with the signed-in player as host.
- `invite_friends({ friendIds })` — invites land in the recipients' own sessions. Re-inviting someone who declined resets them to invited.
- `get_party_status()` — party, member states, whether it's ready.
- `launch_session()` — launches once every invited member has *responded*. Decliners get left behind rather than blocking it forever. Returns `{ status: "not_ready", waitingOn: [...] }` otherwise.

**Party responses (only while an invite is pending)**

- `respond_to_invite({ accept? })` — accept or decline the invitation waiting for the signed-in player.

</details>

### What "about 75 minutes" means

`maxSessionMinutes` is treated as a time budget, not a hard cutoff.

A game fits when its shortest session is within the budget and its longest
session does not exceed the budget by more than 30%.

That rule lives in `SESSION_OVERRUN_FACTOR` in
[`filterGames.ts`](./src/lib/filterGames.ts), and the UI and WebMCP tools use
the same rule.

That's why the UI says "About 60 min" instead of "Under 60 min."

---

## Try it

Open the [live site](https://captainclaw.netlify.app) in Chrome 149-156. The
site is registered for the
[WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial),
so `document.modelContext` is there on load and the tools register with no
setup at all.

It also works in ChatGPT's in-app browser. Outside that Chrome range, or after
the trial token expires on 2026-11-17, enable
`chrome://flags/#enable-webmcp-testing` instead.

Try:

> *"Justin, Robert and Sarah are online. We've got about 75 minutes. Find a
> co-op game all four of us can play, preferably something none of us has
> finished, and nothing scary."*

The expected answer is **Nightfall Signal**, with **Ridge Runners** as the
near-miss because Robert has already finished it.

Then say **"Let's play."** The agent creates the party and sends the
invitations.

Other examples:

- *"Find me something solo under 30 minutes."*
- *"What's in my library I've never started?"*
- *"Justin is playing something right now. Would that work for all four of
  us?"*

Every clause in the hero prompt is doing work, and `npm run check-funnel`
prints the funnel one clause at a time. Drop "nothing scary" and **Hollow
Choir** and **Fathom Line** satisfy the request just as well. An earlier
version of the check excluded horror games in code even when the prompt did
not mention it; it now evaluates the prompt as written.

### Watching a real invite land

Invitations are stored in the backend
([`netlify/functions/party.ts`](./netlify/functions/party.ts) backed by
Netlify Blobs) and appear in the recipient's own session.

1. Open the site, stay as **Alex** (the default), start a party from any
   game page.
2. Open a **second window**, switch **View as** to **Justin**, then go to
   **Party**. The invite is sitting there.
3. Accept as Justin. Alex's window picks it up through polling. No refresh is
   needed.

A second window in the same browser joins automatically. For incognito or a
different browser, use the **Copy** button under "Second player" on the Party
page: that link carries the room id. There's a **Reset demo** link at the
bottom of the Party page.

### One party per room

Each visitor gets an independent party room.

The room id comes from `?room=`, then `localStorage`, then a new random id.
It is written back to the URL so the URL can also be used as a shareable
invite.

This prevents two demo users from accidentally overwriting each other's party
state.

---

## Architecture

Vite, React, TypeScript, Tailwind v4, `react-router-dom`.

Game, user and library data is static bundled TypeScript in `src/data/`.
There are no external APIs or authentication dependencies, which keeps the
demo self-contained. The seed data is built so the hero query lands on
exactly one clean answer plus one legible near-miss, and `npm run
check-funnel` re-verifies that.

The generated library data is also internally consistent. For example, a game
with no `lastPlayedAt` has zero playtime and is not marked complete. This
matters because otherwise simple queries such as *"what have I never
started?"* can produce contradictory results.

The only mutable shared state is the current party, held in Netlify Blobs
behind a single function at `/api/party`, namespaced per room. No database.

### Making agent actions visible

When the agent changes filters or creates a party, the page updates normally
and also shows a short toast.

This matters especially in ChatGPT's in-app browser, where a state change
lower on the page can be easy to miss. The player should be able to see what
the agent just did.

Game covers are procedurally generated from a per-game gradient and
typography ([`GameCover.tsx`](./src/components/GameCover.tsx)). No borrowed
storefront art.

## Running locally

```bash
npm install
npx playwright install chromium   # only for the verification scripts
netlify dev                       # serves the site and /api/party together
```

`npm run dev` works for UI-only development, but use `netlify dev` for the
full app because the party API and WebMCP flow depend on `/api/party`.

## Verification

Scripted rather than click-through, because a deadline is exactly when
regressions slip past a manual pass.

| Command | Purpose |
|---|---|
| `npm run check-funnel` | Verifies the hero scenario against the dataset. Pure data, no browser. |
| `npm run test:ui` | UI smoke tests at 1280px. |
| `npm run test:mobile` | Store and Home at 390px. |
| `npm run test:party` | Two browser sessions exchange a real invitation through the backend. |
| `npm run test:webmcp` | Checks all 13 tools, registration, state changes, errors, and late WebMCP injection. |
| `npm run test:view` | Verifies WebMCP page context matches the rendered UI. |
| `npm run test:evals` | Runs the [WebMCP evals](./evals/webmcp-evals.json) in real Chrome. |

Neither page in `test:party` installs a WebMCP shim, so it doubles as the
check that a plain browser with no agent stays error-free.

`test:party`, `test:webmcp` and `test:evals` need `netlify dev` running in
another terminal. `test:evals` points at `http://localhost:8888/store` by
default; edit the script in `package.json` to aim it at the live URL.

## License

MIT, see [LICENSE](./LICENSE).
