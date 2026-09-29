import { Storefront } from "@/components/Storefront";
import { AuthFlow } from "@/components/AuthFlow";
import { AccountBar } from "@/components/AccountBar";
import { catalog } from "@/lib/catalog";
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
          <p className="eyebrow">Wholesale ingredients · Toronto</p>
          <h1>Stock your bakery.<br />Spend from your shared fund.</h1>
          <p className="heroCopy">Choose what your team needs. Your workshop card posts a simulated purchase and delivers supplies immediately.</p>
        </div>
        <div className="terms"><span>Account terms</span><strong>Net 7</strong><small>Invoices due within seven days</small></div>
      </section>
      <section className="shopLayout"><Storefront products={catalog} /></section>
    </main>
  );
}
