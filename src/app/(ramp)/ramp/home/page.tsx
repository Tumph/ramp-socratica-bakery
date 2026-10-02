import { RampAppShell } from "@/components/ramp/RampAppShell";
import { RampHomeFeed } from "@/components/ramp/RampHomeFeed";
import { WalletPanel } from "@/components/ramp/WalletPanel";
import { sampleHomeData } from "@/lib/ramp/sample-home";

export default function RampHomePage() {
  // Swap this for the signed-in team's data; the components take it as-is.
  const data = sampleHomeData;

  return (
    <RampAppShell nav={data.nav}>
      <div className="rampHomeGrid">
        <RampHomeFeed data={data} />
        <WalletPanel
          title={data.wallet.title}
          viewAllHref={data.wallet.viewAllHref}
        />
      </div>
    </RampAppShell>
  );
}
