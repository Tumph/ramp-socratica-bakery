"use client";

import Link from "next/link";
import { useState } from "react";
import type { ExpenseDetail, ExpenseField } from "@/lib/ramp/types";
import { RampIcon } from "./RampIcon";

function FieldRow({ field, onChange }: { field: ExpenseField; onChange: (id: string, value: string) => void }) {
  return (
    <>
      <div className="rampFieldLabel">
        <RampIcon name={field.icon} />
        <span>{field.label}</span>
      </div>
      <div className="rampFieldValue">
        {field.options ? (
          <span className="rampFieldSelect">
            <select
              aria-label={field.label}
              value={field.value}
              onChange={(event) => onChange(field.id, event.target.value)}
            >
              {field.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <RampIcon name="select-chevron" size={12} />
          </span>
        ) : field.missing ? (
          <button type="button" className="rampFieldMissing">
            <span>{field.value}</span>
            <RampIcon name="chevron-red" size={12} />
          </button>
        ) : field.editable ? (
          /* Edited in place, so no pencil affordance is needed. */
          <input
            type="text"
            className={field.tone === "suggestion" ? "rampFieldInput rampFieldInput--suggestion" : "rampFieldInput"}
            aria-label={field.label}
            value={field.value ?? ""}
            placeholder={`Add a ${field.label.toLowerCase()}`}
            onChange={(event) => onChange(field.id, event.target.value)}
          />
        ) : (
          <span className="rampFieldStatic">{field.value}</span>
        )}
      </div>
    </>
  );
}

export function ExpenseDetailView({ expense }: { expense: ExpenseDetail }) {
  const [fields, setFields] = useState(expense.fields);

  function change(id: string, value: string) {
    setFields((current) => current.map((f) => (f.id === id ? { ...f, value } : f)));
  }

  const incomplete = fields.some((field) => field.missing);

  return (
    <div className="rampExpensePage">
      <div className="rampExpenseMain">
        <div className="rampExpenseScroll">
          <div className="rampExpenseInner">
            <Link href="/ramp" className="rampBackLink">
              <span aria-hidden>&larr;</span> Home
            </Link>

            <header className="rampExpenseHeader">
              {expense.merchantLogoSrc && (
                <img className="rampExpenseLogo" src={expense.merchantLogoSrc} alt="" aria-hidden />
              )}
              <h1 className="rampExpenseHeading">
                {expense.amountLabel} at {expense.merchantName}
              </h1>
              <div className="rampExpenseMetaRow">
                <p className="rampExpenseMetaText">
                  <a href="#">{expense.cardholder}</a>
                  <span aria-hidden> · </span>
                  <a href="#">{expense.merchantName}</a>
                  <span aria-hidden> · </span>
                  <span>{expense.occurredAtLabel}</span>
                </p>
                <button type="button" className="rampLinkMenu">
                  Options <RampIcon name="chevron-down-16" size={12} />
                </button>
              </div>
            </header>

            {expense.notice && (
              <aside className="rampNotice rampExpenseNotice" role="status">
                <div className="rampNoticeBody">
                  <h2 className="rampNoticeTitle">{expense.notice.title}</h2>
                  <p className="rampNoticeText rampExpenseNoticeText">{expense.notice.body}</p>
                </div>
                <button type="button" className="rampLinkMenu">
                  {expense.notice.actionLabel} <RampIcon name="chevron-down-16" size={12} />
                </button>
              </aside>
            )}

            <section className="rampDetails">
              <div className="rampSectionHead">
                <RampIcon name="chevron-down-16" />
                <h2>Details</h2>
                <span className="rampBadge">{incomplete ? "Incomplete" : "Complete"}</span>
                <button type="button" className="rampLinkMenu rampSectionAction">
                  Add fields <RampIcon name="chevron-down-16" size={12} />
                </button>
              </div>

              <div className="rampFieldGrid">
                {fields.map((field) => (
                  <FieldRow key={field.id} field={field} onChange={change} />
                ))}
              </div>

              {expense.requirementsNote && (
                <p className="rampRequirements">
                  {expense.requirementsNote.prefix}{" "}
                  <a href="#">{expense.requirementsNote.source}</a>
                </p>
              )}
            </section>

            {expense.sections.map((section) => (
              <section key={section.id} className="rampCollapsedSection">
                <div className="rampSectionHead">
                  <RampIcon name="chevron-right" />
                  <h2>{section.title}</h2>
                  {section.badge && (
                    <span className={section.badge.tone === "positive" ? "rampBadge rampBadge--positive" : "rampBadge"}>
                      {section.badge.label}
                    </span>
                  )}
                  {section.action && (
                    <button type="button" className="rampLinkMenu rampSectionAction">
                      <RampIcon name="memo-sparkle" size={12} /> {section.action}
                    </button>
                  )}
                </div>
              </section>
            ))}

            <section className="rampActivity">
              <div className="rampSectionHead">
                <RampIcon name="chevron-down-16" />
                <h2>Activity</h2>
                <button type="button" className="rampLinkMenu rampSectionAction">
                  All activity <RampIcon name="chevron-down-16" size={12} />
                </button>
              </div>
              <ol className="rampTimeline">
                {expense.activity.map((event) => (
                  <li key={event.id}>
                    <span className="rampTimelineAvatar">
                      {event.avatarSrc
                        ? <img src={event.avatarSrc} alt="" aria-hidden />
                        : <RampIcon name="timeline-dot" />}
                    </span>
                    <span className="rampTimelineText">{event.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <footer className="rampExpenseFooter">
          <button type="button" className="rampSubmitWide" disabled={incomplete}>
            <RampIcon name="check" /> <span>Submit</span>
          </button>
        </footer>
      </div>

    </div>
  );
}
