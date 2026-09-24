import { Button, Callout } from "../../design";
import type { InviteBlocker } from "../../db/team";
import { renderPage } from "../Layout";
import type { DashboardUser } from "../types";

export interface InvitePageData {
  user?: DashboardUser;
  token: string;
  ownerEmail: string | null;
  inviteEmail: string | null;
  userEmail: string | null;
  blocker: InviteBlocker | null;
}

/** What the signed-in person can do about each reason an invite can't be accepted right now. */
function blockerMessage(data: InvitePageData): string {
  switch (data.blocker) {
    case "not_found":
      return "This invite link isn't valid. Ask for a new one.";
    case "expired":
      return "This invite has expired. Ask the team owner to send a new one.";
    case "already_used":
      return "This invite has already been used.";
    case "own_team":
      return "This is an invite to your own workspace.";
    case "wrong_email":
      return `This invite was sent to ${data.inviteEmail ?? "a different address"}, but you're signed in as ${data.userEmail ?? "an account with no email"}. Sign in with the invited address to accept.`;
    case "already_member":
      return "You're already on a team. Leave it from Settings first, then open this link again.";
    case "owns_team":
      return "You have members in your own workspace. Remove them from Settings first, then open this link again.";
    case "has_paid_plan":
      return "You have your own paid plan. Cancel it from Billing first, so you're not paying twice, then open this link again.";
    case "team_inactive":
      return "This team isn't on the Team plan right now, so it can't take new members.";
    case "team_full":
      return "This team has no free seats left. Ask the owner to free one up.";
    default:
      return "";
  }
}

function InvitePage({ data }: { data: InvitePageData }) {
  return (
    <>
      <h1>Team invite</h1>
      <section class="panel">
        {data.blocker ? (
          <Callout>
            <p>{blockerMessage(data)}</p>
          </Callout>
        ) : (
          <>
            <p>
              <strong>{data.ownerEmail ?? "A team owner"}</strong> invited you to their Team workspace.
            </p>
            <p class="muted">
              While you're a member, the dashboard, your API keys and Google connections all point at their workspace. Your own
              workspace stays exactly as it is, and you go back to it if you leave.
            </p>
            <form method="post" action={`/dashboard/invite/${encodeURIComponent(data.token)}/accept`}>
              <Button variant="primary">Join team</Button>
            </form>
          </>
        )}
      </section>
    </>
  );
}

export function renderInvite(data: InvitePageData): string {
  return renderPage({ title: "Team invite", activePath: "/dashboard/settings", user: data.user, children: <InvitePage data={data} /> });
}
