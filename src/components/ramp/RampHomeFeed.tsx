"use client";

import { useState } from "react";
import type { HomeData } from "@/lib/ramp/types";
import { greetingFor } from "@/lib/ramp/format";
import { viewerFor } from "@/lib/ramp/from-config";
import { useRampConfig } from "./RampConfigProvider";
import { ChecklistSection } from "./ChecklistSection";
import { AnimationTuner } from "./AnimationTuner";
import { DevStateToggle } from "./DevStateToggle";
import { IncompleteExpensesSection } from "./IncompleteExpensesSection";
import { RampNotice } from "./RampNotice";

export function RampHomeFeed({ data }: { data: HomeData }) {
  const { notices, checklist, incompleteExpenses } = data;
  const { config } = useRampConfig();
  const viewer = viewerFor(config);

  // Dev-only switch so the empty and populated states can both be demoed
  // before expenses come from the database.
  const [showIncomplete, setShowIncomplete] = useState(incompleteExpenses.length > 0);
  const [submitted, setSubmitted] = useState<string[]>([]);

  const expenses = showIncomplete
    ? incompleteExpenses.filter((expense) => !submitted.includes(expense.id))
    : [];

  return (
    <div className="rampFeed">
      <AnimationTuner />

      <DevStateToggle
        label="Incomplete expenses"
        value={showIncomplete ? "some" : "none"}
        onChange={(id) => {
          setShowIncomplete(id === "some");
          if (id === "some") setSubmitted([]);
        }}
        options={[
          { id: "none", label: "None" },
          { id: "some", label: `${incompleteExpenses.length}` },
        ]}
      />

      <h1 className="rampGreeting">
        {greetingFor()}, {viewer.firstName}
      </h1>

      {notices.map((notice) => (
        <RampNotice key={notice.id} notice={notice} />
      ))}

      <IncompleteExpensesSection
        expenses={expenses}
        onSubmit={(id) => setSubmitted((current) => [...current, id])}
      />

      <ChecklistSection title={checklist.title} tasks={checklist.tasks} />
    </div>
  );
}
