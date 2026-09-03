# Submission text description

Live URL: https://agent-native-gaming-platform.netlify.app
Repo: https://github.com/PurpleWizard07/agent-native-gaming-platform (MIT license)

---

### Why is your use case a strong fit for WebMCP?

Almost every "AI gaming assistant" demo is a recommendation engine wearing a
chat window — and that could be built with a plain remote MCP server, no
browser required. This project's tools are deliberately not that. Four of
the thirteen tools exist specifically because they live in the page:
`get_current_view` reads what the player is actually looking at right now —
the page, the filters they set by hand, the games currently on screen —
something no server-side agent has access to. `apply_filters` and `open_game`
drive the player's own screen, so the shortlist the agent is reasoning about
becomes visible instead of staying as chat text.

Crucially, the registered tool set changes with the player's context, which
is a property only an in-page tool can have. `apply_filters` appears only
where there are filters to set (Store, Library); `get_current_view` and
`open_game` also appear on a game page, where "this game" has an answer —
open the WebMCP panel in Chrome DevTools on Home and all of them are gone.
Nine tools on Home, twelve on the Store. The fourth, `respond_to_invite`, is
gated on *state* rather than route: it is registered only while an invitation
is actually pending, and only in the invited player's own session, so Alex's
agent can answer on Alex's behalf. Its mere presence tells an agent there is
something to respond to — and it makes the flow agent-to-agent coordination
through a shared platform rather than one agent driving one screen.

### How does it create a better user experience?

Coordinating a group game session today is ten manual steps across four
browser tabs and a group chat: check who's online, check what everyone owns,
cross-reference player counts and session length, remember who's already
finished what, pick one, create a party, invite everyone, wait, start. One
sentence to the agent collapses that into a recommendation with a visible,
checkable reason — and the platform's own state changes in response, not
just a text answer. The agent assembles the party; the player keeps the one
moment that matters, pressing Launch.

### What can people and agents do together that was difficult or impossible before?

A player can filter the Store by hand, then hand the *result* to the agent —
"do any of these work for the four of us tonight?" — and get an answer about
the exact list they're looking at. The agent can create a real party and send
real invitations that land in a friend's own browser session, where the
invited player's *own* agent can accept them (verified with two independent
browser sessions exchanging a live invite through the actual backend, not a
mocked timer).

And the platform is honest about failure. When no game satisfies every
constraint, the agent says so and names the closest option instead of faking
a perfect match — Ridge Runners fails the hero query on exactly one clause,
and says which. `launch_session` refuses to start while anyone is still
undecided and names who. Tool errors come back as data (`{ error: "no active
party" }`), so an agent recovers instead of stalling. None of that is
available from a page an agent can only search from the outside.

### How did you implement WebMCP?

Thirteen tools, registered with `document.modelContext.registerTool` through
a small React hook that handles registration/cleanup via `AbortController`,
wraps return values in the MCP content-array shape, and turns a thrown error
into `{ error: ... }` with `isError: true` so an agent can act on it. Five
read tools (`get_online_friends`, `get_my_library`, `get_friend_libraries`,
`search_games`, `get_game_details`) are global. Three page-context tools
(`get_current_view`, `apply_filters`, `open_game`) read and write the same
React context that drives the page's own UI, and are registered per page
rather than all-or-nothing. Five party tools (`create_party`,
`invite_friends`, `get_party_status`, `respond_to_invite`, `launch_session`)
call the exact same functions the Party page's own buttons call, against a
real backend (one Netlify Function over Netlify Blobs) — so the agent and the
human are always driving one shared, real state, never two parallel code
paths.

Two details worth calling out. Read tools declare
`annotations: { readOnlyHint: true }`, so a host can auto-approve the seven
that only look and prompt for the six that change something; without it,
"check who's online" and "launch the session" look identical to an agent
host. And registration waits for `document.modelContext` rather than sampling
it once at mount — a host that injects the API after first paint would
otherwise get a page with zero tools and no error anywhere.

Verification is scripted rather than clicked: an eval suite
(`evals/webmcp-evals.json`) run with Chrome DevRel's `webmcp-evals smoke`
command against real Chrome (15/15 steps passing), plus browser scripts
covering per-page and per-state registration, `get_current_view` matching the
real DOM, two independent sessions exchanging a live invite, and a dataset
check that prints the hero query's funnel one clause at a time.

---

## Demo video shot list (for the recorder)

1. 0:00–0:20 — the site, browsed by hand. It's a real product on its own.
2. 0:20–0:35 — filter the Store by hand (co-op, 4 players).
3. 0:35–1:20 — the hero prompt; the agent reads the view, checks libraries,
   answers with the pick **and the near-miss** (Nightfall Signal / Ridge
   Runners — Sam's already finished it).
4. 1:20–2:10 — party created, invite lands in a second window as Alex, Alex
   accepts, **you click Launch** yourself.
5. 2:10–2:40 — Chrome DevTools' WebMCP panel: 12 tools on Store, only 9 on
   Home, and `respond_to_invite` appearing in Alex's window only while his
   invite is pending — the tool set changing with context is the point.
6. 2:40–3:00 — one line: "The agent and the player operate the same screen."
