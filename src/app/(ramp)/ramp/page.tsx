import { redirect } from "next/navigation";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { RampAppShell } from "@/components/ramp/RampAppShell";
import { RampHomeFeed } from "@/components/ramp/RampHomeFeed";
import { WalletPanel } from "@/components/ramp/WalletPanel";
import { sampleHomeData } from "@/lib/ramp/sample-home";

export const dynamic = "force-dynamic";

export default async function RampHomePage() {
  if (await getCurrentAdmin()) redirect("/admin");
  if (!(await getCurrentUser())) redirect("/");
  const data = sampleHomeData;

  return (
    <RampAppShell nav={data.nav}>
      <div className="rampHomeGrid">
        <RampHomeFeed data={data} />
        <WalletPanel title={data.wallet.title} viewAllHref={data.wallet.viewAllHref} />
      </div>
    </RampAppShell>
  );
}
