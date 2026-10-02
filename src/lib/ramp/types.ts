// View-model contract for the Ramp simulator UI.
//
// Every screen renders from these shapes, so a team's real fund, card and
// transaction data can replace the sample data without touching components.

export type IconName =
  | "logo-mark-grey"
  | "nav-home"
  | "nav-expenses"
  | "nav-travel"
  | "nav-manage"
  | "search"
  | "bell"
  | "plus"
  | "help"
  | "chevron-down-12"
  | "chevron-down-16"
  | "home"
  | "envelope"
  | "external-link"
  | "lyft"
  | "wallet"
  | "phone"
  | "close"
  | "chevron-down-expense"
  | "overflow-menu"
  | "select-chevron"
  | "upload"
  | "memo-sparkle"
  | "check"
  | "copy"
  | "issued-amount"
  | "issued-card"
  | "issued-people"
  | "card-avatar"
  | "field-card"
  | "field-receipt"
  | "field-category"
  | "edit"
  | "chevron-red"
  | "chevron-right"
  | "timeline-dot"
  | "eye-off";

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  /** Omit to render an inert button that looks the part but does not navigate. */
  href?: string;
  /** Rendered as the yellow pill on the right of the row. */
  badge?: number;
};

export type Viewer = {
  /** Used for the "Good evening, {firstName}" greeting. */
  firstName: string;
  /** Two-letter avatar monogram. */
  initials: string;
};

export type Notice = {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  actionLabel: string;
  dismissible?: boolean;
};

/** One row of the "Before you spend" checklist. */
export type ChecklistTask = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  /** Appends the ↗ glyph to the action, as the Chrome extension row does. */
  actionExternal?: boolean;
  completed?: boolean;
  /** Mutually exclusive with imageSrc. */
  icon?: IconName;
  /** Raster logos (Chrome) that are not part of the icon set. */
  imageSrc?: string;
};

/**
 * A spend card in the wallet sidebar. `limitCents` omitted means no progress
 * bar is drawn — matching "General Card", which shows a balance only.
 */
export type WalletCard = {
  id: string;
  name: string;
  remainingCents: number;
  currency: string;
  limitCents?: number;
  href?: string;
  /** Present when the card can be opened in the detail drawer. */
  detail?: CardDetail;
};

/** One line of the "What's issued?" list. */
export type IssuedFact = { icon: IconName; label: string };

/**
 * Card detail shown in the drawer.
 *
 * Only the last four digits are ever modelled: AGENTS.md forbids storing a PAN,
 * CVV or expiry, and the design shows a masked number, so there is nothing here
 * that could carry real card credentials.
 */
export type CardDetail = {
  displaySuffix: string;
  nameOnCard: string;
  billingAddress: string[];
  /** e.g. "Signature Business" — printed under the network mark. */
  networkTier?: string;
  issued: IssuedFact[];
  requestHref?: string;
  /** Flips to show simulator-only credentials when true. */
  revealable?: boolean;
};

/** One transaction still missing a receipt, memo, or other required detail. */
export type IncompleteExpense = {
  id: string;
  amountCents: number;
  currency: string;
  merchantName: string;
  /** Merchant logo; falls back to a monogram when absent. */
  merchantLogoSrc?: string;
  /** Pre-formatted for now, e.g. "Sep 29 at 8:53 p.m.". */
  occurredAtLabel: string;
  /** Card the spend was drawn from — the "Spent from" field. */
  spentFrom: string;
  spentFromOptions?: string[];
  receiptRequired?: boolean;
  memoRequired?: boolean;
  /** Prefilled memo; the design shows a suggested one in blue. */
  memo?: string;
};

export type HomeData = {
  viewer: Viewer;
  nav: NavItem[];
  notices: Notice[];
  checklist: { title: string; tasks: ChecklistTask[] };
  /** Section renders only when this is non-empty. */
  incompleteExpenses: IncompleteExpense[];
  /** Omit viewAllHref to render an inert "View all" that does not navigate. */
  wallet: { title: string; viewAllHref?: string; cards: WalletCard[] };
};

/** One labelled row in the expense Details grid. */
export type ExpenseField = {
  id: string;
  icon: IconName;
  label: string;
  /** Rendered as a select when options are supplied. */
  value?: string;
  options?: string[];
  /** "Upload a receipt (required)" renders in the warning colour. */
  missing?: boolean;
  /** Memo renders in blue. */
  tone?: "default" | "suggestion";
  /** Renders an inline text input rather than static text. */
  editable?: boolean;
};

export type TimelineEvent = {
  id: string;
  /** Avatar image; falls back to a neutral dot. */
  avatarSrc?: string;
  text: string;
};

export type ExpenseSection = {
  id: string;
  title: string;
  badge?: { label: string; tone: "neutral" | "positive" };
  /** Collapsed sections render the title row only. */
  collapsed?: boolean;
  action?: string;
};

/** Full detail view for one incomplete expense. */
export type ExpenseDetail = {
  id: string;
  amountLabel: string;
  merchantName: string;
  merchantLogoSrc?: string;
  cardholder: string;
  occurredAtLabel: string;
  notice?: { title: string; body: string; actionLabel: string };
  fields: ExpenseField[];
  requirementsNote?: { prefix: string; source: string };
  sections: ExpenseSection[];
  activity: TimelineEvent[];
};
