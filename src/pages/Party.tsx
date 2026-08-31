import { useState } from "react";
import { Link } from "react-router-dom";
import { GAME_BY_ID } from "../data/games";
import { USER_BY_ID } from "../data/users";
import { useSession } from "../state/SessionContext";
import { useParty } from "../state/PartyContext";
import type { MemberState } from "../types/party";

const STATE_LABEL: Record<MemberState, string> = { invited: "Invited", accepted: "Accepted", declined: "Declined" };
const STATE_CLASS: Record<MemberState, string> = {
  invited: "bg-neutral-800 text-neutral-400",
  accepted: "bg-emerald-900/50 text-emerald-400",
  declined: "bg-red-950/50 text-red-400",
};

export function Party() {
  const { viewer, friends } = useSession();
  const { party, loading, inviteFriends, respond, launch, reset } = useParty();
  const [launching, setLaunching] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  if (!party) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-neutral-400">
        <h1 className="text-lg font-semibold text-white">No active party</h1>
        <p className="max-w-sm text-sm">
          Pick a game from the <Link to="/store" className="text-violet-400 hover:text-violet-300">Store</Link> and hit Play to start one.
        </p>
      </div>
    );
  }

  const game = GAME_BY_ID[party.gameId];
  const isHost = party.hostId === viewer.id;
  const myMembership = party.members.find((m) => m.userId === viewer.id);
  const invitableFriends = friends.filter((f) => !party.members.some((m) => m.userId === f.id));
  const readyToLaunch = party.status === "ready";

  const handleLaunch = async () => {
    setLaunching(true);
    setBusy(true);
    await launch();
    setTimeout(() => setLaunching(false), 1200);
    setBusy(false);
  };

  const withBusy = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Party</p>
        <h1 className="text-2xl font-bold text-neutral-100">{game?.title ?? party.gameId}</h1>
      </section>

      {(launching || party.status === "launched") && (
        <section className="rounded-lg border border-violet-800 bg-violet-950/40 px-4 py-3 text-sm font-medium text-violet-300">
          {launching ? "Launching…" : `${game?.title ?? "Session"} — SESSION READY`}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Members</h2>
        <div className="space-y-2">
          {party.members.map((m) => {
            const user = USER_BY_ID[m.userId];
            return (
              <div key={m.userId} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: user?.avatar ?? "#666" }} />
                <span className="font-medium text-neutral-100">{user?.name ?? m.userId}</span>
                {m.userId === party.hostId && <span className="text-xs text-neutral-500">Host</span>}
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_CLASS[m.state]}`}>{STATE_LABEL[m.state]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {myMembership?.state === "invited" && (
        <section className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
          <span className="text-sm text-neutral-300">You've been invited to play {game?.title}.</span>
          <button
            disabled={busy}
            onClick={() => withBusy(() => respond(viewer.id, true))}
            className="ml-auto rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            disabled={busy}
            onClick={() => withBusy(() => respond(viewer.id, false))}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
          >
            Decline
          </button>
        </section>
      )}

      {isHost && invitableFriends.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Invite friends</h2>
          <div className="flex flex-wrap gap-2">
            {invitableFriends.map((f) => (
              <button
                key={f.id}
                disabled={busy}
                onClick={() => withBusy(() => inviteFriends([f.id]))}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
              >
                Invite {f.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {isHost && (
        <section>
          <button
            disabled={!readyToLaunch || busy || party.status === "launched"}
            onClick={handleLaunch}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {party.status === "launched" ? "Launched" : "Launch"}
          </button>
          {!readyToLaunch && party.status !== "launched" && (
            <p className="mt-2 text-xs text-neutral-500">Waiting for everyone to accept before this can launch.</p>
          )}
        </section>
      )}

      <section className="border-t border-neutral-800 pt-4">
        <button onClick={() => withBusy(reset)} className="text-xs text-neutral-500 underline hover:text-neutral-300">
          Reset demo
        </button>
      </section>
    </div>
  );
}
