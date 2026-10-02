import { AuthFlow } from "@/components/AuthFlow";
import { AccountBar } from "@/components/AccountBar";
import { getAuthenticatedUser, getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { TeamSetup } from "@/components/TeamSetup";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await getCurrentAdmin()) redirect("/admin");
  const user = await getCurrentUser();
  if (!user) return <main>{await getAuthenticatedUser() ? <TeamSetup /> : <AuthFlow />}</main>;

  return (
    <main>
      <AccountBar email={user.email} teamName={user.teamName} teamId={user.teamId} />
      <section className="hero">
        <div>
          <p className="eyebrow">Workshop commerce</p>
          <h1>New storefronts<br />coming soon.</h1>
          <p className="heroCopy">Your workshop card and shared fund are ready for the upcoming store experience.</p>
        </div>
        <div className="terms"><span>Store status</span><strong>In redesign</strong><small>Check back when the new stores open.</small></div>
      </section>
    </main>
  );
}
