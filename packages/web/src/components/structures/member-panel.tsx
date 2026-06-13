import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MatrixClientPeg } from "../../client/peg";
import { groupMembersByRole, useMemberRoles } from "../../hooks/use-member-roles";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";
import { usePendingRoomInvites } from "../../hooks/use-pending-room-invites";
import { InviteUserDialog } from "../dialogs/invite-user";
import { MemberRow } from "./member-row";

interface MemberPanelProps {
  roomId: string;
  spaceId: string | null;
}

export function MemberPanel({ roomId, spaceId }: MemberPanelProps) {
  const members = useMemberRoles(roomId);
  const pending = usePendingRoomInvites(roomId);
  const myPL = useMyPowerLevel(roomId);
  const [inviteOpen, setInviteOpen] = useState(false);

  const room = MatrixClientPeg.safeGet()?.getRoom(roomId);
  const invitePL =
    (room?.currentState.getStateEvents("m.room.power_levels", "")?.getContent() as {
      invite?: number;
    } | null)?.invite ?? 50;
  const canInvite = myPL.level >= invitePL;
  const hasPending = pending.length > 0;

  const membersList = (
    <div className="space-y-4">
      {groupMembersByRole(members).map((group) => (
        <section key={group.kind}>
          <h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground">
            {group.label} · {group.members.length}
          </h3>
          <ul className="space-y-1">
            {group.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 py-0.5">
                <MemberRow roomId={roomId} userId={m.userId} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {canInvite && spaceId && (
        <Button
          variant="outline"
          size="sm"
          className="mb-3 w-full"
          onClick={() => setInviteOpen(true)}
        >
          Invite
        </Button>
      )}
      {hasPending && (
        <section className="mb-4">
          <h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground">
            Invited · {pending.length}
          </h3>
          <ul className="space-y-1">
            {pending.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 py-0.5">
                <MemberRow roomId={roomId} userId={m.userId} membership="invite" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {membersList}
      {spaceId && (
        <InviteUserDialog
          open={inviteOpen}
          roomId={roomId}
          spaceId={spaceId}
          onOpenChange={setInviteOpen}
        />
      )}
    </div>
  );
}
