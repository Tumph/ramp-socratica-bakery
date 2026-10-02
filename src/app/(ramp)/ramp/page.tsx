import { RampHeader } from "@/components/ramp/RampHeader";
import { RampLoginForm } from "@/components/ramp/RampLoginForm";

export default function RampLoginPage() {
  return (
    <div className="rampShell">
      <RampHeader />
      <main className="rampAuth">
        <div className="rampAuthInner">
          <h1>Welcome to Ramp</h1>
          <RampLoginForm />
        </div>
      </main>
    </div>
  );
}
