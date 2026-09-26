import { Storefront } from "@/components/Storefront";
import { AuthFlow } from "@/components/AuthFlow";
import { AccountBar } from "@/components/AccountBar";
import { catalog } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getAuthenticatedUser } from "@/lib/auth";
import { TeamSetup } from "@/components/TeamSetup";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <main>{await getAuthenticatedUser() ? <TeamSetup /> : <AuthFlow />}</main>;

  return (
    <main>
      <AccountBar email={user.email} teamName={user.teamName} teamId={user.teamId} />
      <section className="hero">
        <div>
          <p className="eyebrow">Wholesale ingredients · Toronto</p>
          <h1>Stock your bakery.<br />Pay the invoice in Ramp.</h1>
          <p className="heroCopy">Choose what your team needs. We will send the bill to your Ramp Sandbox account and deliver after payment.</p>
        </div>
        <div className="terms"><span>Account terms</span><strong>Net 7</strong><small>Invoices due within seven days</small></div>
      </section>
      <section className="shopLayout"><Storefront products={catalog} /></section>
    </main>
  );
}
