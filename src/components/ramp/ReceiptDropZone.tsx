"use client";

import { useRef, useState } from "react";
import { RampIcon } from "./RampIcon";

export function ReceiptDropZone({ onFile }: { onFile?: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function accept(next: File | null) {
    if (!next) return;
    setFile(next);
    onFile?.(next);
  }

  return (
    <div className="rampPreview">
      <button
        type="button"
        className={dragging ? "rampDropZone rampDropZone--dragging" : "rampDropZone"}
        onClick={() => input.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <span className="rampDropZoneInner">
          <RampIcon name="upload" />
          <span className="rampDropZoneTitle">
            {file ? file.name : "Drop files or click to upload"}
          </span>
          <span className="rampDropZoneHint">
            Accepts PDF, PNG, JPG, HEIC, or WEBP, up to 20 MB per file
          </span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/heic,image/webp"
        className="rampVisuallyHidden"
        aria-label="Upload a receipt"
        onChange={(event) => accept(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
