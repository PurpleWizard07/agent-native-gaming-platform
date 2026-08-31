import { useTool } from "./useTool";
import { useSession } from "../state/SessionContext";
import { useParty } from "../state/PartyContext";

interface CreatePartyInput {
  gameId: string;
}

interface InviteFriendsInput {
  friendIds: string[];
}

// Party tools — registered globally. These call the exact same
// PartyContext methods the Party page's own buttons use, so the agent and
// the human are always driving one shared, real state, not two code paths.
export function PartyTools() {
  const { viewer } = useSession();
  const { party, createParty, inviteFriends, launch } = useParty();

  useTool<CreatePartyInput>({
    name: "create_party",
    description: "Create a play session for a chosen game with the signed-in player as host. Call only after the player has agreed to a specific game.",
    inputSchema: {
      type: "object",
      properties: { gameId: { type: "string" } },
      required: ["gameId"],
      additionalProperties: false,
    },
    execute: async (input) => createParty(input.gameId, viewer.id),
  });

  useTool<InviteFriendsInput>({
    name: "invite_friends",
    description:
      "Invite one or more friends to the current party. Invitations appear immediately in each friend's own browser session; they must accept before the session can launch.",
    inputSchema: {
      type: "object",
      properties: { friendIds: { type: "array", items: { type: "string" } } },
      required: ["friendIds"],
      additionalProperties: false,
    },
    execute: async (input) => {
      const updated = await inviteFriends(input.friendIds);
      return { members: updated.members, status: updated.status };
    },
  });

  useTool({
    name: "get_party_status",
    description:
      "Read the current party: the game, each member's state (invited / accepted / declined), and whether the session is ready to launch. Poll after inviting to see who has accepted.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () => {
      if (!party) return { active: false };
      return {
        active: true,
        partyId: party.id,
        gameId: party.gameId,
        members: party.members,
        status: party.status,
        readyToLaunch: party.status === "ready",
      };
    },
  });

  useTool({
    name: "launch_session",
    description:
      "Start the play session. Requires every invited member to have accepted. This is the final player-facing action — confirm with the player before calling it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => {
      if (!party || party.status !== "ready") return { status: "not_ready" };
      await launch();
      return { status: "launching" };
    },
  });

  return null;
}
