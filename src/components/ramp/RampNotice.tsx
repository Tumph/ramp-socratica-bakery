"use client";

import { useState } from "react";
import type { Notice } from "@/lib/ramp/types";
import { RampButton } from "./RampButton";
import { RampIcon } from "./RampIcon";

export function RampNotice({ notice, onAction }: { notice: Notice; onAction?: (id: string) => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside className="rampNotice" role="status">
      <div className="rampNoticeBody">
        <div className="rampNoticeHead">
          <RampIcon name={notice.icon} />
          <h2 className="rampNoticeTitle">{notice.title}</h2>
        </div>
        <p className="rampNoticeText">{notice.body}</p>
      </div>

      <div className="rampNoticeActions">
        <RampButton onClick={() => onAction?.(notice.id)}>{notice.actionLabel}</RampButton>
        {notice.dismissible && (
          <button
            type="button"
            className="rampIconBtn rampNoticeDismiss"
            aria-label={`Dismiss: ${notice.title}`}
            onClick={() => setDismissed(true)}
          >
            <RampIcon name="close" />
          </button>
        )}
      </div>
    </aside>
  );
}
