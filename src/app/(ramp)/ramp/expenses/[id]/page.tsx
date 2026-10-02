import { notFound } from "next/navigation";
import { RampAppShell } from "@/components/ramp/RampAppShell";
import { ExpenseDetailView } from "@/components/ramp/ExpenseDetailView";
import { sampleExpenses } from "@/lib/ramp/sample-expense";
import { sampleHomeData } from "@/lib/ramp/sample-home";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expense = sampleExpenses[id];
  if (!expense) notFound();

  return (
    <RampAppShell nav={sampleHomeData.nav}>
      <ExpenseDetailView expense={expense} />
    </RampAppShell>
  );
}
