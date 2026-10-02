"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { IncompleteExpense } from "@/lib/ramp/types";
import { RampIcon } from "./RampIcon";

function ExpenseCard({ expense, onSubmit }: { expense: IncompleteExpense; onSubmit?: (id: string) => void }) {
  const [spentFrom, setSpentFrom] = useState(expense.spentFrom);
  const [memo, setMemo] = useState(expense.memo ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // The native input is visually hidden, so it cannot be a drop target itself;
  // the styled control handles the drag events and feeds the same state.
  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) setReceipt(file);
  }

  const amount = `${(expense.amountCents / 100).toFixed(2)} ${expense.currency}`;
  const options = expense.spentFromOptions?.length ? expense.spentFromOptions : [expense.spentFrom];

  return (
    <article className="rampExpense">
      <header className="rampExpenseHead">
        <span className="rampExpenseAvatar">
          {expense.merchantLogoSrc ? (
            <img src={expense.merchantLogoSrc} alt="" aria-hidden />
          ) : (
            <span className="rampExpenseMonogram">{expense.merchantName.slice(0, 1)}</span>
          )}
        </span>

        <Link href={`/ramp/expenses/${expense.id}`} className="rampExpenseMeta">
          <span className="rampExpenseTitle">
            {amount} at {expense.merchantName}
          </span>
          <span className="rampExpenseDate">{expense.occurredAtLabel}</span>
        </Link>

        <button type="button" className="rampIconBtn" aria-label={`More actions for ${expense.merchantName}`}>
          <RampIcon name="overflow-menu" />
        </button>
      </header>

      <div className="rampExpenseBody">
        <div className="rampField2">
          <label className="rampField2Label" htmlFor={`spent-from-${expense.id}`}>Spent from</label>
          <select
            id={`spent-from-${expense.id}`}
            className="rampField2Control"
            value={spentFrom}
            onChange={(event) => setSpentFrom(event.target.value)}
          >
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <RampIcon name="select-chevron" className="rampField2Icon" />
        </div>

        <button
          type="button"
          className={dragging ? "rampUpload rampUpload--dragging" : "rampUpload"}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => {
            // Ignore drags moving between this button's own children.
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={onDrop}
        >
          <span className={receipt ? "rampUploadLabel rampUploadLabel--filled" : "rampUploadLabel"}>
            {dragging
              ? "Drop the receipt here"
              : receipt
                ? receipt.name
                : `Upload a receipt${expense.receiptRequired ? " (required)" : ""}`}
          </span>
          <RampIcon name="upload" />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          className="rampVisuallyHidden"
          aria-label="Upload a receipt"
          onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
        />

        <div className="rampField2">
          <label className="rampField2Label" htmlFor={`memo-${expense.id}`}>
            Add a memo{expense.memoRequired && <span className="rampRequired"> *</span>}
          </label>
          <input
            id={`memo-${expense.id}`}
            type="text"
            className="rampField2Control"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>

        <button type="button" className="rampSubmitExpense" onClick={() => onSubmit?.(expense.id)}>
          <RampIcon name="check" />
          <span>Submit</span>
        </button>
      </div>
    </article>
  );
}

export function IncompleteExpensesSection({
  expenses,
  onSubmit,
}: {
  expenses: IncompleteExpense[];
  onSubmit?: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  // The section is absent entirely when nothing is incomplete.
  if (expenses.length === 0) return null;

  return (
    <section className="rampChecklist rampIncomplete">
      <div className="rampChecklistHead">
        <button
          type="button"
          className="rampCollapse"
          aria-expanded={open}
          aria-label={open ? "Collapse Incomplete expenses" : "Expand Incomplete expenses"}
          onClick={() => setOpen((value) => !value)}
        >
          <RampIcon
            name="chevron-down-expense"
            size={12}
            className={open ? "" : "rampIcon--collapsed"}
          />
        </button>
        <div>
          <h2 className="rampChecklistTitle">Incomplete expenses</h2>
          <p className="rampChecklistCount">These are missing receipts, memos, or other details</p>
        </div>
      </div>

      {open && (
        <div className="rampExpenseStack">
          {expenses.map((expense) => (
            <ExpenseCard key={expense.id} expense={expense} onSubmit={onSubmit} />
          ))}
        </div>
      )}
    </section>
  );
}
