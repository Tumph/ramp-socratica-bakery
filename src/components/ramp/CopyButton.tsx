"use client";

import { useState } from "react";
import { RampIcon } from "./RampIcon";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(event: React.MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard is unavailable over plain http or without permission; the
      // value stays selectable on the page, so fail quietly.
    }
  }

  return (
    <button
      type="button"
      className="rampCopy"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      <RampIcon name="copy" size={12} />
      {copied && <span className="rampCopied" role="status">Copied</span>}
    </button>
  );
}
