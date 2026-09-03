# Agent-Native Gaming Platform — Locked Concept

> **Status: LOCKED.** This document is the design of record. Build order lives in
> [implementation-plan.md](implementation-plan.md).

---

## 1. Locked Summary

| Element | Decision |
|---|---|
| Product | One gaming platform (store + library + friends + parties) |
| Pages | Home, Store, Library, Friends, Game, Party — **6** |
| Data | Synthetic, deterministic, internally consistent (Purple, Alex, Sam, Maya) |
| WebMCP tools | **12** — read, page-context, party |
| Hero flow | Group session orchestration, ending in a **human-clicked Launch** |
| Second player | **Real** — a second browser session as Alex receives a real invite |
| Agent interface | ChatGPT in-app browser; Chrome with `#enable-webmcp-testing` |
| Website UX | Normal gaming platform. No agent-activity sidebar. |
| Hosting | Netlify (static site + one Netlify Function + Netlify Blobs) |
| Cut | Wishlist, deals, purchases, weekend planner, backlog cleanup, achievements |
| Thesis | The platform isn't something an agent can *search*. It's something an agent can *operate* — alongside the human, on the same screen. |

**Design constraint above all others:** a judge must understand what this is
within 90 seconds of looking at it. Every feature that doesn't serve the hero
flow is cut.

---

## 2. Positioning

Do **not** pitch:

- "We built a Steam alternative."
- "We built an AI game recommender."
- "We built a smarter game store."

Pitch:

> **The agent and the player operate the same screen.** The agent handles the
> coordination — who's online, who owns what, what fits tonight, who's invited.
> The player keeps the moment that matters: pressing Launch.

---

## 3. The Problem

A gaming platform already surfaces the information. The *player* is the one who
has to coordinate it into a decision and then execute that decision:

```
Who's online? → What do we all own? → Which support 4 players?
→ Which fit tonight's 75 minutes? → Which has nobody finished?
→ Pick one → Create party → Invite everyone → Wait → Start
```

Ten steps, four browser tabs, one group chat. That is exactly the kind of
workflow an agent collapses — and exactly the kind that needs platform *state
changes*, not just answers.

---

## 4. Why WebMCP Specifically (not just an MCP server)

This is the section the project has to earn. A plain remote MCP server could
serve a library, a catalog, and a party endpoint. What it **cannot** do is share
a screen with the human. Three capabilities exist only because the tools live in
the page:

1. **The agent can read what the human is looking at.** The player filters the
   store by hand, then asks *"any of these work for tonight?"* —
   `get_current_view` returns the actual on-screen result set and the filters the
   human set. No server-side agent has access to that.

2. **The agent can drive the human's screen.** `apply_filters` and `open_game`
   change what the player sees, so the shortlist the agent reasoned about becomes
   visible instead of staying as chat text.

3. **Tools appear and disappear with context.** Page-context tools register only
   on views that have a filterable list. The available tool set reflects where the
   human actually is — a property of in-page tools, not of a static server.

Everything else — libraries, catalog, parties — is table stakes. These three are
the argument.

---

## 5. Platform Definition — 6 Pages

**Home** — greeting, Continue Playing row, Friends Online strip, recommended row.

**Store** — game grid with real filters: genre, player count, co-op, session
length. The filter bar is the surface `get_current_view` / `apply_filters` read
and write.

**Library** — owned games with filters: unplayed / in progress / completed /
installed. Same filter contract as Store.

**Friends** — Alex, Sam, Maya online; Chris offline; shows what each is playing.

**Game** — title, genres, player counts, co-op modes, typical session length,
ownership, which friends own it, Play button.

**Party** — the game, member list with invite state (invited / accepted /
declined), and a **Launch** button that only enables once everyone has accepted.

Cut from the earlier draft: Wishlist, Activity/Profile, achievements, reviews,
system requirements, cart, purchases.

---

## 6. Data Model

Static, bundled with the client — no network, no failure modes:

```
User          id, name, avatar, presence, playingGameId
Game          id, title, genres[], minPlayers, maxPlayers, coopModes[],
              sessionMinutes{min,max}, description, cover
LibraryEntry  userId, gameId, playtimeMinutes, completed, installed, lastPlayedAt
Friendship    userId, friendId
```

Mutable, shared across browser sessions via Netlify Blobs — **one object only**:

```
Party         id, gameId, hostId, members[{userId, state}], status, updatedAt
              state:  invited | accepted | declined
              status: forming | ready | launching | launched
```

Deliberate simplification: presence is static. Only the party is live. That keeps
8 of the 13 tools purely local and instant, and confines all network risk to one
endpoint.

---

## 7. Seed Data — The Reasoning Funnel

~24 games in the catalog. Purple owns ~14. The seed data is **designed backwards
from the hero query**, so the reasoning is legible and lands on one answer:

```
Games all four own      12
   ↓ supports 4 players  8
   ↓ fits 75 minutes     5
   ↓ nobody finished     3
   ↓ co-op, not horror   1  ← the answer, plus 1 near-miss
```

### The designed near-miss

Not every scenario resolves perfectly, and the agent should say so plainly:

> "Nothing satisfies all four constraints. **Nightfall Signal** is the best fit —
> all four of you own it, 4-player co-op, 45–70 minute sessions, nobody has
> finished it. **Ridge Runners** also fits the time and the group, but Sam
> completed it last month."

This single behaviour is the difference between a system that reasons and a
script that pretends to. It must appear in the demo video.

### Example constraint table

| Game | Players | Session | Why it survives or fails |
|---|---|---|---|
| A | 2 | — | fails player count |
| B | 4 | 4–6 h | fails session length |
| C | 4 | 60 min | horror — excluded by preference |
| D | 4 | 45–70 min | **all constraints met, nobody finished** |

---

## 8. WebMCP Tool Surface — The 12

Descriptions matter more than count. Each one states what it returns, when to
reach for it, and how it differs from its siblings — that is where the WebMCP
score is actually won.

### Read — registered globally

```javascript
get_online_friends()
// "List the player's friends with online status and what each is playing right
//  now. Call this first for any request involving 'us', 'we', or named friends,
//  to confirm who is actually available before recommending anything."
// → [{ id, name, presence, playingGameId }]

get_my_library({ onlyUnfinished?, onlyInstalled? })
// "List the games the signed-in player owns, with playtime, completion state,
//  install state and last played date. The starting set for both solo picks and
//  group matching."
// → [{ gameId, title, playtimeMinutes, completed, installed, lastPlayedAt }]

get_friend_libraries({ friendIds: string[] })
// "List which games each named friend owns and which they have completed. Pass
//  every friend at once. Returns ownership and completion only — call
//  get_game_details for player counts and session length."
// → { [friendId]: [{ gameId, completed }] }

search_games({ query?, genres?, minPlayers?, coop?, maxSessionMinutes? })
// "Search and filter the catalog by text, genre, supported player count, co-op
//  support and typical session length. Prefer this over reading the page when you
//  need games matching hard constraints like 'supports 4' or 'under 75 minutes'.
//  Does not know who owns what — intersect with the library tools."
// → [{ gameId, title, genres, minPlayers, maxPlayers, sessionMinutes }]

get_game_details({ gameIds: string[] })
// "Full detail for one or more games: genres, player counts, co-op modes,
//  typical session length, description, and which of the player's friends own it.
//  Use after narrowing candidates, to compare them precisely."
// → [{ ...game, friendsWhoOwn: [{ id, name }] }]
```

Ownership intersection is deliberately **not** a tool parameter. The agent does
that reasoning itself from `get_my_library` + `get_friend_libraries`, which keeps
the reasoning visible instead of hidden inside one server-side match endpoint.

### Page context — registered only on Store and Library

```javascript
get_current_view()
// "Describe what the player is looking at right now: the current page, the
//  filters they set by hand, and the games visible on screen. Call this whenever
//  the request refers to the screen — 'these', 'this list', 'what I'm looking
//  at' — instead of searching the catalog from scratch."
// → { page, filters, visibleGameIds, selectedGameId }

apply_filters({ genres?, minPlayers?, coop?, maxSessionMinutes?, onlyUnfinished?, clear? })
// "Set the filters on the view the player is currently looking at, updating their
//  screen. Use it to show the player the shortlist you are reasoning about."
// → { filters, visibleGameIds }

open_game({ gameId })
// "Navigate the player's screen to a game's page. Call this once you have chosen a
//  recommendation, so the player is looking at the game you are describing."
// → { gameId, title }
```

### Party — registered globally

```javascript
create_party({ gameId })
// "Create a play session for a chosen game with the signed-in player as host.
//  Call only after the player has agreed to a specific game."
// → { partyId, gameId, members, status }

invite_friends({ friendIds: string[] })
// "Invite one or more friends to the current party. Invitations appear
//  immediately in each friend's own browser session; they must accept before the
//  session can launch."
// → { members, status }

get_party_status()
// "Read the current party: the game, each member's state (invited / accepted /
//  declined), and whether the session is ready to launch. Poll after inviting to
//  see who has accepted."
// → { partyId, gameId, members, status, readyToLaunch }

launch_session()
// "Start the play session. Requires every invited member to have accepted. This
//  is the final player-facing action — confirm with the player before calling it."
// → { status: "launching" | "launched" }
```

**On `launch_session`:** the tool exists so an agent can complete the flow
end-to-end, and judges exploring on their own will expect it to work. But the
scripted demo deliberately leaves the last click to the human. That handoff is
the memorable beat.

### Optional 13th (stretch, only if everything else is done) — BUILT

`respond_to_invite({ accept })` — registered in a friend's session, letting
*Alex's* agent accept on Alex's behalf. Agent-to-agent coordination through a
shared platform. Genuinely novel, entirely optional. Do not let it delay the
core 12.

**Shipped** in the post-review pass (see implementation-plan.md Phase 7). It
went further than planned in one respect: it is registered only *while an
invitation is actually pending*, so its mere presence tells an agent there is
something to answer. That makes it the one tool gated on state rather than
route, and a second demonstration of the property that only in-page tools
have.

---

## 9. UX Principles

**Reflect state, don't expose agent internals.** No `AGENT ACTIVITY` log. When
the agent acts, the site reacts the way a site reacts: the Game page opens, the
Party page appears, member rows change state.

**But make the reaction legible.** In ChatGPT's in-app browser the viewport is
narrow and quiet state changes get missed. Use *diegetic* feedback — a toast
("Party created"), an invite badge in the nav, a member row flipping to Accepted.
Realistic UI that doubles as visible evidence.

**The handoff is the product.** The agent assembles; the human launches. Design
the Party page so that final button is the obvious, satisfying last step.

**The site must stand alone.** Home, Store, Library and Friends have to be
browsable and credible *before* a judge engages the agent layer. That is what
makes WebMCP land as an enhancement rather than a technical playground.

---

## 10. The Hero Demo — Four Beats

1. **Human filters the Store by hand** — co-op, 4 players.
2. **Human asks:** *"Any of these work for the four of us tonight? About 75
   minutes, nothing we've already finished."*
3. **Agent reads the current view**, checks the three friends' libraries, and
   answers with the pick **and the near-miss** — reasoning, not lookup.
4. **Agent creates the party and invites Alex, Sam and Maya.** A real invite lands
   in a second browser window. Alex accepts. **The human clicks Launch.**

Beat 1 is what makes this WebMCP rather than an MCP server. Beat 4 is what a
judge remembers.

---

## 11. Judges Exploring On Their Own

Because the tools are live in the page, judges can go past the script:

- "Find me something solo under 30 minutes."
- "What's in my library I've never started?"
- "Which of my friends plays this?"
- "Alex is playing something — would that work for all four of us?"

Every one of these is answerable with the shipped tools. That turns the submission
from one scripted video into an application a judge can actually operate.

---

## 12. Non-Goals

Explicitly out of scope. Each was considered and cut for legibility:

| Cut | Why |
|---|---|
| Wishlist, deals, cart, purchases | Agent shopping is the most done-to-death WebMCP demo; a whole extra flow, no extra score |
| Weekend planner, backlog cleanup | Interesting, but dilutes the hero flow |
| Achievements, reviews, system requirements | Page furniture that costs real time |
| Activity / Profile pages | Folds into Home |
| Real game launching | The platform simulates a session start; the README says so plainly |
| Auth / accounts | A "View as" switcher is enough, and is honest for a demo platform |

---

## 13. Asset Rights & Honesty

Original or generated artwork only — **no copied Steam or Epic assets**. Cover
art is generated once and committed, with prompts and licensing noted in the
repo. An OSI license file (MIT) sits at the repo root, detectable in the About
section.

README disclaimer, verbatim:

> This is a fictional gaming platform inspired by familiar digital game-store and
> social-gaming workflows. All users, libraries and friend data are synthetic; no
> real game is launched. The project demonstrates how such a platform can be made
> agent-operable through WebMCP.

---

## 14. Differentiation

The WebMCP ecosystem already has games an agent can *play* (Maze, React Chess)
and a long tail of search / booking / commerce demos. This is neither. The agent
operates the platform **around** the game: social context, discovery,
coordination, party state, session start — and it does so on the same screen as
the human, reading the view they built by hand.

---

## 15. Deployment — Netlify

- Static Vite build published from `dist`, SPA redirect for client routing.
- **One** Netlify Function (`/api/party`) for shared party state.
- **Netlify Blobs** as the store — no database, no external service, no config.
- HTTPS by default, which WebMCP requires.
- A visible **Reset demo** control, so any judge starts from a clean state.

Full detail in [implementation-plan.md](implementation-plan.md).
