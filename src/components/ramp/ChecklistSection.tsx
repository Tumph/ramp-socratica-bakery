"use client";

import { useState } from "react";
import type { ChecklistTask } from "@/lib/ramp/types";
import { RampButton } from "./RampButton";
import { RampIcon } from "./RampIcon";

function ChecklistRow({ task, onAction }: { task: ChecklistTask; onAction?: (id: string) => void }) {
  return (
    <li className="rampTask">
      <span className="rampTaskAvatar">
        {task.imageSrc ? (
          <img src={task.imageSrc} alt="" aria-hidden className="rampTaskImage" />
        ) : task.icon ? (
          <RampIcon name={task.icon} />
        ) : null}
      </span>

      <span className="rampTaskText">
        <span className="rampTaskTitle">{task.title}</span>
        <span className="rampTaskDesc">{task.description}</span>
      </span>

      <RampButton
        iconAfter={task.actionExternal ? "external-link" : undefined}
        onClick={() => onAction?.(task.id)}
      >
        {task.actionLabel}
      </RampButton>
    </li>
  );
}

export function ChecklistSection({
  title,
  tasks,
  onAction,
}: {
  title: string;
  tasks: ChecklistTask[];
  onAction?: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const completed = tasks.filter((task) => task.completed).length;

  return (
    <section className="rampChecklist">
      <div className="rampChecklistHead">
        <button
          type="button"
          className="rampCollapse"
          aria-expanded={open}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          onClick={() => setOpen((value) => !value)}
        >
          <RampIcon name="chevron-down-12" size={12} className={open ? "" : "rampIcon--collapsed"} />
        </button>
        <div>
          <h2 className="rampChecklistTitle">{title}</h2>
          <p className="rampChecklistCount">
            {completed} of {tasks.length} completed
          </p>
        </div>
      </div>

      {open && (
        <>
          <hr className="rampRule" />
          <ul className="rampTasks">
            {tasks.map((task) => (
              <ChecklistRow key={task.id} task={task} onAction={onAction} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
