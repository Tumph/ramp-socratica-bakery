import type { HomeData } from "./types";

// Stand-in data shaped exactly like the live contract will be. Swap this for a
// per-team fetch (team_funds + mock_cards) without changing any component.
export const sampleHomeData: HomeData = {
  viewer: { firstName: "Jack", initials: "JA" },

  nav: [
    { id: "home", label: "Home", icon: "nav-home", href: "/ramp/home", badge: 5 },
    { id: "expenses", label: "Expenses", icon: "nav-expenses" },
    { id: "travel", label: "Travel", icon: "nav-travel" },
    { id: "manage", label: "Manage", icon: "nav-manage" },
  ],

  notices: [
    {
      id: "phone",
      icon: "phone",
      title: "Add your phone number",
      body: "Finish expenses by text in seconds—no login required. Receipts stay organized and your account stays secure.",
      actionLabel: "Add now",
      dismissible: true,
    },
  ],

  checklist: {
    title: "Before you spend",
    tasks: [
      {
        id: "address",
        icon: "home",
        title: "Add your home address",
        description: "We’ll auto-detect trips and personalize travel",
        actionLabel: "Add home address",
      },
      {
        id: "email",
        icon: "envelope",
        title: "Connect your email",
        description: "We’ll automatically match receipts from your inbox",
        actionLabel: "Connect email",
      },
      {
        id: "chrome",
        imageSrc: "/ramp/icons/chrome.png",
        title: "Get the Chrome extension",
        description: "We’ll grab your receipts from merchants while you browse",
        actionLabel: "Get extension",
        actionExternal: true,
      },
      {
        id: "lyft",
        icon: "lyft",
        title: "Connect to Lyft",
        description: "Automate receipts and memos after every Lyft ride",
        actionLabel: "Connect",
      },
    ],
  },

  incompleteExpenses: [
    {
      id: "michaels-0929",
      amountCents: 1168,
      currency: "CAD",
      merchantName: "Michaels",
      merchantLogoSrc: "/ramp/icons/merchant-michaels.png",
      occurredAtLabel: "Sep 29 at 8:53 p.m.",
      spentFrom: "Ramp x Socratica - Making Dough",
      spentFromOptions: ["Ramp x Socratica - Making Dough", "F26 Sessions", "General Card"],
      receiptRequired: true,
      memoRequired: true,
      memo: "Craft supplies for community co-working session",
    },
  ],

  wallet: {
    title: "Virtual cards",
    cards: [
      {
        id: "socratica",
        name: "Ramp x Socratica - Making Dough",
        remainingCents: 130_000,
        limitCents: 370_000,
        currency: "CAD",
        detail: {
          displaySuffix: "8870",
          revealable: true,
          nameOnCard: "Jack Reindeer",
          billingAddress: ["28 W 23rd St, Floor 2", "New York, NY, US", "10010"],
          networkTier: "Signature Business",
          requestHref: "#",
          issued: [
            { icon: "issued-amount", label: "$3,700.00 total" },
            { icon: "issued-card", label: "Virtual card-only" },
            { icon: "issued-people", label: "Not shareable with other employees" },
          ],
        },
      },
      {
        id: "f26",
        name: "F26 Sessions",
        remainingCents: 25_899,
        limitCents: 189_459,
        currency: "CAD",
        detail: {
          displaySuffix: "4412",
          nameOnCard: "Jack Reindeer",
          billingAddress: ["28 W 23rd St, Floor 2", "New York, NY, US", "10010"],
          networkTier: "Signature Business",
          requestHref: "#",
          issued: [
            { icon: "issued-amount", label: "$1,894.59 total" },
            { icon: "issued-card", label: "Virtual card-only" },
            { icon: "issued-people", label: "Not shareable with other employees" },
          ],
        },
      },
    ],
  },
};
