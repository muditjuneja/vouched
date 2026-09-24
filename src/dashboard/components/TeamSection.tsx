import { Button, Table } from "../../design";
import type { TeamSettings } from "../types";

function PausedNotice({ team }: { team: TeamSettings }) {
  return (
    <section class="panel">
      <h2>Team</h2>
      <p>
        You're a member of {team.pausedTeamOwnerEmail ?? "a team"}'s workspace, but it isn't on the Team plan right now, so you're
        back in your own workspace. You'll return automatically when it's renewed.
      </p>
      <form method="post" action="/dashboard/team/leave" class="inline" onsubmit="return confirm('Leave this team for good?')">
        <Button size="sm">Leave team</Button>
      </form>
    </section>
  );
}

export function TeamSection({ team }: { team: TeamSettings }) {
  if (team.pausedTeamOwnerEmail) return <PausedNotice team={team} />;
  const isOwner = team.role === "owner";
  const seatsUsed = 1 + team.members.length + team.pendingInvites.length;

  return (
    <section class="panel">
      <h2>Team</h2>
      <p class="muted">
        {seatsUsed} of {team.seatLimit} seats used. Everyone shares this workspace's websites and Google connections; each person has
        their own API keys.
      </p>
      <Table headers={["Person", "Role", ""]}>
        <tr>
          <td data-label="Person">{team.ownerEmail ?? "unknown"}</td>
          <td data-label="Role">Owner</td>
          <td data-label="Action" />
        </tr>
        {team.members.map((member) => (
          <tr>
            <td data-label="Person">{member.email ?? "unknown"}</td>
            <td data-label="Role">Member</td>
            <td data-label="Action" class="col-actions">
              {isOwner ? (
                <form
                  method="post"
                  action={`/dashboard/team/members/${encodeURIComponent(member.userId)}/remove`}
                  class="inline"
                  onsubmit="return confirm('Remove this person? Their API keys for this workspace stop working immediately.')"
                >
                  <Button size="sm">Remove</Button>
                </form>
              ) : null}
            </td>
          </tr>
        ))}
        {isOwner
          ? team.pendingInvites.map((invite) => (
              <tr>
                <td data-label="Person">{invite.email}</td>
                <td data-label="Role" class="muted">
                  Invited, expires {invite.expiresAt.slice(0, 10)}
                </td>
                <td data-label="Action" class="col-actions">
                  <form method="post" action={`/dashboard/team/invites/${encodeURIComponent(invite.inviteId)}/revoke`} class="inline">
                    <Button size="sm">Withdraw</Button>
                  </form>
                </td>
              </tr>
            ))
          : null}
      </Table>

      {isOwner && team.canInvite ? (
        <form method="post" action="/dashboard/team/invites" class="row" style="margin-top:0.75rem">
          <input type="email" name="email" placeholder="teammate@example.com" required />
          <Button variant="primary" size="sm">
            Send invite
          </Button>
        </form>
      ) : null}
      {isOwner && !team.canInvite && seatsUsed >= team.seatLimit ? (
        <p class="muted" style="margin-top:0.75rem">All seats are taken. Remove someone or withdraw an invite to free one up.</p>
      ) : null}

      {!isOwner ? (
        <form
          method="post"
          action="/dashboard/team/leave"
          class="inline"
          style="margin-top:0.75rem"
          onsubmit="return confirm('Leave this team? Your API keys for it stop working and you go back to your own workspace.')"
        >
          <Button size="sm">Leave team</Button>
        </form>
      ) : null}
    </section>
  );
}
