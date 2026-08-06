/** Core domain model for the expense tracker (local-first). */

export type TxType = "income" | "expense";

export type PaymentMethod = "cash" | "card" | "bank" | "wallet" | "other";

/** Soft-delete tombstone timestamp, shared by all synced records. */
export interface Syncable {
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when soft-deleted; null when live. Enables sync of deletes. */
  deletedAt: string | null;
}

export interface Category extends Syncable {
  id: string;
  name: string;
  /** Which side of the ledger this category belongs to. */
  type: TxType;
  /** A token from the finance chart palette: "chart-1".."chart-6". */
  color: string;
  /** lucide-react icon name, resolved at render time. */
  icon: string;
  /** Seeded defaults cannot be deleted, only archived. */
  isDefault: boolean;
  archived: boolean;
}

export interface Transaction extends Syncable {
  id: string;
  type: TxType;
  /** Positive amount in major currency units (e.g. rupees). */
  amount: number;
  categoryId: string;
  note: string;
  /** Calendar date, ISO "YYYY-MM-DD" (no time component). */
  date: string;
  method: PaymentMethod;
}

export type BudgetScope = "overall" | "category";

export interface Budget extends Syncable {
  id: string;
  scope: BudgetScope;
  /** null when scope === "overall". */
  categoryId: string | null;
  /** Monthly limit in major currency units. */
  amount: number;
}

/** A person you lend money to or borrow money from. */
export interface Person extends Syncable {
  id: string;
  name: string;
  note: string;
}

/**
 * A single money movement in the People & Debts ledger.
 * - "lent": you gave them money → they owe you (+)
 * - "received": they repaid you → reduces what they owe (−)
 * - "borrowed": you took money from them → you owe them (−)
 * - "repaid": you paid them back → reduces what you owe (+)
 * Net owed to you = lent − received − borrowed + repaid.
 */
export type DebtKind = "lent" | "received" | "borrowed" | "repaid";

export interface DebtEntry extends Syncable {
  id: string;
  personId: string;
  kind: DebtKind;
  /** Positive amount in major currency units. */
  amount: number;
  note: string;
  /** Calendar date, ISO "YYYY-MM-DD". */
  date: string;
}

/** A savings target the user is working toward. */
export interface SavingsGoal extends Syncable {
  id: string;
  name: string;
  /** Target amount in major currency units. */
  target: number;
  note: string;
  /** Chart palette token for the goal's accent. */
  color: string;
  /** lucide icon name. */
  icon: string;
  /** Optional target date, ISO "YYYY-MM-DD" or null. */
  targetDate: string | null;
}

/** A single contribution toward (or withdrawal from) a savings goal. */
export interface SavingsContribution extends Syncable {
  id: string;
  goalId: string;
  /** Positive = added to savings; negative = withdrawn. */
  amount: number;
  note: string;
  /** Calendar date, ISO "YYYY-MM-DD". */
  date: string;
}

/** Kinds of holdings the assets tracker understands (drives icon/label defaults). */
export type AssetKind =
  | "gold"
  | "silver"
  | "property"
  | "stocks"
  | "crypto"
  | "cash"
  | "other";

/**
 * A held asset (gold, property, shares, …) tracked at cost and revalued
 * manually against a current unit price or total value the user updates.
 */
export interface Asset extends Syncable {
  id: string;
  name: string;
  kind: AssetKind;
  /** Quantity for unit-priced assets (e.g. 2.5 grams); null for lump-sum. */
  quantity: number | null;
  /** Unit label for the quantity, e.g. "gram", "tola", "share"; "" when lump-sum. */
  unit: string;
  /** Purchase date, ISO "YYYY-MM-DD". */
  purchaseDate: string;
  /** Total price paid for the quantity, in major currency units. */
  purchaseAmount: number;
  /** Extra acquisition cost — packaging, making charges, fees. */
  extraCost: number;
  /** Latest known price per unit, in major currency units; null until set. */
  currentUnitPrice: number | null;
  /** Direct current total value for lump-sum assets (no unit); null otherwise. */
  currentValue: number | null;
  /** ISO timestamp when the current price/value was last set; null if never. */
  priceUpdatedAt: string | null;
  note: string;
  /** Chart palette token for the asset's accent. */
  color: string;
  /** lucide icon name. */
  icon: string;
}

export type CurrencyCode = "PKR" | "USD" | "EUR" | "GBP" | "INR" | "AED" | "SAR";

export interface AppSettings {
  id: "app";
  name: string;
  currency: CurrencyCode;
  /** 1 = month starts on the 1st; supports salary-cycle budgeting. */
  monthStartDay: number;
  hasCompletedSetup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
  /** BCP-47 locale used for Intl number formatting. */
  locale: string;
}
