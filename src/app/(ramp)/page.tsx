import { redirect } from "next/navigation";
import { RampHeader } from "@/components/ramp/RampHeader";
import { RampLoginForm } from "@/components/ramp/RampLoginForm";
import { getAuthenticatedUser, getCurrentAdmin, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  if (await getCurrentUser()) redirect("/ramp");

  const authenticated = await getAuthenticatedUser();
  return (
    <div className="rampShell">
      <RampHeader />
      <main className="rampAuth">
        <div className="rampAuthInner">
          <h1>Welcome to Ramp</h1>
          {authenticated ? (
            <p className="rampNote">You’re signed in. Open the team invitation email from your event admin to finish joining your bakery.</p>
          ) : (
            <RampLoginForm />
          )}
        </div>
      </main>
    </div>
  );
}
