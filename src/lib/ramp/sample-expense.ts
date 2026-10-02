import type { ExpenseDetail } from "./types";

// Stand-in detail for the one sample expense. The cardholder, accounting
// category, requirement source and activity timeline are invented for now —
// none of them exist in the simulator schema yet.
export const sampleExpenses: Record<string, ExpenseDetail> = {
  "michaels-0929": {
    id: "michaels-0929",
    amountLabel: "11.68 CAD",
    merchantName: "Michaels",
    merchantLogoSrc: "/ramp/expense/merchant.png",
    cardholder: "Jake Rudolph",
    occurredAtLabel: "Sep 29, 2026 at 8:53 p.m.",

    notice: {
      title: "Missing items",
      body: "Complete the missing items for this transaction.",
      actionLabel: "More actions",
    },

    fields: [
      {
        id: "spent-from",
        icon: "field-card",
        label: "Spent from",
        value: "Ramp x Socratica - Making Dough (9623)",
        options: [
          "Ramp x Socratica - Making Dough (9623)",
          "F26 Sessions (4412)",
        ],
      },
      {
        id: "memo",
        icon: "memo-sparkle",
        label: "Memo",
        value: "Craft supplies for community co-working session",
        tone: "suggestion",
        editable: true,
      },
      {
        id: "category",
        icon: "field-category",
        label: "Accounting Category",
        value: "400-300 - Special Projects",
        options: ["400-300 - Special Projects", "500-100 - Supplies", "600-200 - Events"],
      },
    ],

    requirementsNote: { prefix: "Requirements set by", source: "General Expenses" },

    sections: [
      { id: "approvals", title: "Approvals", badge: { label: "Complete", tone: "positive" }, collapsed: true, action: "Ask Ramp" },
      { id: "accounting", title: "Accounting", badge: { label: "Unsynced", tone: "neutral" }, collapsed: true, action: "Mark ready" },
    ],

    activity: [
      { id: "cleared", avatarSrc: "/ramp/expense/merchant.png", text: "Michaels cleared this transaction" },
      { id: "category", avatarSrc: "/ramp/expense/rampcircle.png", text: "“Category” was set to “Special Projects” by a coding rule" },
      { id: "spent", avatarSrc: "/ramp/expense/avatar.png", text: "Spent CA$11.68 at Michaels" },
    ],
  },
};
