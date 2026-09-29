import Link from "next/link";

export function TeamSetup() {
  return (
    <section className="teamSetup">
      <header className="teamSetupIntro">
        <p className="eyebrow">Team assignment</p>
        <h1>You’re signed in.</h1>
        <p>Your event admin will email you a team invitation. Open that sign-in link to join the bakery team they selected for you.</p>
      </header>
      <section className="panel teamAssignmentNotice" aria-label="Assignment status">
        <h2>Waiting for your invitation</h2>
        <p className="mutedCopy">Use the sign-in link in your invitation email. Once it has been accepted, select the button below to open your team workspace.</p>
        <Link className="secondary" href="/">Check assignment</Link>
      </section>
    </section>
  );
}
