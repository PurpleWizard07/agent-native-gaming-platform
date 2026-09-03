import { useTool } from "./useTool";
import { toArray } from "./normalize";
import { useSession } from "../state/SessionContext";
import { useParty } from "../state/PartyContext";
import { useToast } from "../state/ToastContext";
import { GAME_BY_ID } from "../data/games";
import { USER_BY_ID } from "../data/users";

interface CreatePartyInput {
  gameId: string;
}

interface InviteFriendsInput {
  friendIds: string[];
}

interface RespondToInviteInput {
  accept?: boolean;
}

function nameOf(userId: string): string {
  return USER_BY_ID[userId]?.name ?? userId;
}

function titleOf(gameId: string): string {
  return GAME_BY_ID[gameId]?.title ?? gameId;
}

// Party tools — registered globally, except respond_to_invite, which is
// registered only while this player actually has an invitation pending. These
// call the exact same PartyContext methods the Party page's own buttons use,
// so the agent and the human are always driving one shared, real state, not
// two code paths.
export function PartyTools() {
  const { viewer } = useSession();
  const { party, createParty, inviteFriends, respond, launch } = useParty();
  const { notify } = useToast();

  const myMembership = party?.members.find((m) => m.userId === viewer.id);
  const hasPendingInvite = myMembership?.state === "invited";

  useTool<CreatePartyInput>({
    name: "create_party",
    description: "Create a play session for a chosen game with the signed-in player as host. Call only after the player has agreed to a specific game.",
    inputSchema: {
      type: "object",
      properties: { gameId: { type: "string" } },
      required: ["gameId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const created = await createParty(input.gameId, viewer.id);
      notify(`Party created — ${titleOf(input.gameId)}`);
      return created;
    },
  });

  useTool<InviteFriendsInput>({
    name: "invite_friends",
    description:
      "Invite one or more friends to the current party. Invitations appear immediately in each friend's own browser session; they must respond before the session can launch.",
    inputSchema: {
      type: "object",
      properties: { friendIds: { type: "array", items: { type: "string" } } },
      required: ["friendIds"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      const friendIds = toArray(input.friendIds);
      const updated = await inviteFriends(friendIds);
      notify(`Invited ${friendIds.map(nameOf).join(", ")}`);
      return { members: updated.members, status: updated.status };
    },
  });

  useTool({
    name: "get_party_status",
    description:
      "Read the current party: the game, each member's state (invited / accepted / declined), and whether the session is ready to launch. Poll after inviting to see who has responded.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => {
      if (!party) return { active: false };
      return {
        active: true,
        partyId: party.id,
        gameId: party.gameId,
        gameTitle: titleOf(party.gameId),
        members: party.members.map((m) => ({ ...m, name: nameOf(m.userId) })),
        status: party.status,
        readyToLaunch: party.status === "ready",
      };
    },
  });

  // The one tool that lives in the *invited* player's session rather than the
  // host's: it lets Justin's agent respond on Justin's behalf, which is what makes
  // this agent-to-agent coordination through a shared platform rather than one
  // agent driving one screen. Registering it only while an invite is pending
  // means its mere presence tells an agent there is something to answer — the
  // same dynamic-availability property the page-context tools have, gated on
  // state instead of route.
  useTool<RespondToInviteInput>(
    {
      name: "respond_to_invite",
      description:
        "Accept or decline the party invitation currently waiting for the signed-in player. This tool is registered only while an invitation is actually pending, so its presence means there is something to respond to. Confirm with the player before accepting on their behalf.",
      inputSchema: {
        type: "object",
        properties: {
          accept: { type: "boolean", description: "True to accept, false to decline. Defaults to accepting." },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const accept = input.accept !== false;
        const updated = await respond(viewer.id, accept);
        notify(accept ? `You accepted the invite` : `You declined the invite`);
        return {
          accepted: accept,
          gameId: updated.gameId,
          gameTitle: titleOf(updated.gameId),
          members: updated.members,
          status: updated.status,
        };
      },
    },
    hasPendingInvite,
  );

  useTool({
    name: "launch_session",
    description:
      "Start the play session. Requires every invited member to have responded — anyone who declined is left behind rather than blocking the launch. This is the final player-facing action — confirm with the player before calling it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false },
    execute: async () => {
      if (!party) return { status: "not_ready", reason: "no active party" };
      if (party.status === "launched") return { status: "launched" };
      if (party.status !== "ready") {
        const waitingOn = party.members.filter((m) => m.state === "invited").map((m) => nameOf(m.userId));
        return {
          status: "not_ready",
          reason: waitingOn.length > 0 ? `waiting on ${waitingOn.join(", ")} to respond` : "nobody has accepted yet",
          waitingOn,
        };
      }
      await launch();
      notify(`Launching ${titleOf(party.gameId)}`);
      return { status: "launching", gameId: party.gameId, gameTitle: titleOf(party.gameId) };
    },
  });

  return null;
}
