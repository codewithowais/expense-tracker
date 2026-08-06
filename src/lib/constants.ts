import type { AssetKind, Currency, CurrencyCode, PaymentMethod, TxType } from "./types";

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  PKR: { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", decimals: 0, locale: "en-PK" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2, locale: "en-IE" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2, locale: "en-GB" },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2, locale: "en-IN" },
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2, locale: "en-AE" },
  SAR: { code: "SAR", symbol: "﷼", name: "Saudi Riyal", decimals: 2, locale: "en-SA" },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: "cash", label: "Cash", icon: "Banknote" },
  { value: "card", label: "Card", icon: "CreditCard" },
  { value: "bank", label: "Bank transfer", icon: "Landmark" },
  { value: "wallet", label: "Wallet", icon: "Wallet" },
  { value: "other", label: "Other", icon: "Ellipsis" },
];

/** The finance chart palette tokens, in order. */
export const CATEGORY_COLORS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
] as const;

/** Curated lucide icon names offered in the category picker. */
export const CATEGORY_ICONS = [
  "ShoppingCart", "Utensils", "Home", "Car", "Bus", "Plane", "Fuel",
  "Zap", "Wifi", "Smartphone", "HeartPulse", "Pill", "Dumbbell",
  "GraduationCap", "BookOpen", "Gift", "Shirt", "Film", "Gamepad2",
  "Coffee", "Baby", "PawPrint", "Wrench", "Sparkles", "Landmark",
  "PiggyBank", "TrendingUp", "Briefcase", "Wallet", "Coins", "Gem",
  "DollarSign", "ReceiptText", "Building2", "HandCoins", "Percent",
] as const;

/**
 * Asset kinds with their display label and sensible defaults (icon, accent,
 * and unit). Selecting a kind in the asset form pre-fills these.
 */
export const ASSET_KINDS: {
  value: AssetKind;
  label: string;
  icon: string;
  color: string;
  /** Default unit for unit-priced kinds; "" means lump-sum (no quantity). */
  unit: string;
}[] = [
  { value: "gold", label: "Gold", icon: "Gem", color: "chart-4", unit: "gram" },
  { value: "silver", label: "Silver", icon: "Coins", color: "chart-2", unit: "gram" },
  { value: "property", label: "Property", icon: "Building2", color: "chart-1", unit: "" },
  { value: "stocks", label: "Stocks", icon: "TrendingUp", color: "chart-5", unit: "share" },
  { value: "crypto", label: "Crypto", icon: "Coins", color: "chart-3", unit: "coin" },
  { value: "cash", label: "Cash / FX", icon: "Wallet", color: "chart-6", unit: "" },
  { value: "other", label: "Other", icon: "Sparkles", color: "chart-1", unit: "" },
];

export const ASSET_KIND_MAP = Object.fromEntries(
  ASSET_KINDS.map((k) => [k.value, k]),
) as Record<AssetKind, (typeof ASSET_KINDS)[number]>;

interface SeedCategory {
  name: string;
  type: TxType;
  color: string;
  icon: string;
}

/** Sensible starter categories, seeded on first run. */
export const DEFAULT_CATEGORIES: SeedCategory[] = [
  // Expenses
  { name: "Groceries", type: "expense", color: "chart-1", icon: "ShoppingCart" },
  { name: "Dining", type: "expense", color: "chart-3", icon: "Utensils" },
  { name: "Rent & Bills", type: "expense", color: "chart-4", icon: "Home" },
  { name: "Transport", type: "expense", color: "chart-6", icon: "Car" },
  { name: "Utilities", type: "expense", color: "chart-2", icon: "Zap" },
  { name: "Health", type: "expense", color: "chart-5", icon: "HeartPulse" },
  { name: "Education", type: "expense", color: "chart-4", icon: "GraduationCap" },
  { name: "Entertainment", type: "expense", color: "chart-5", icon: "Film" },
  { name: "Shopping", type: "expense", color: "chart-3", icon: "Shirt" },
  { name: "Other", type: "expense", color: "chart-2", icon: "Ellipsis" },
  // Income
  { name: "Salary", type: "income", color: "chart-1", icon: "Briefcase" },
  { name: "Freelance", type: "income", color: "chart-6", icon: "Sparkles" },
  { name: "Investments", type: "income", color: "chart-2", icon: "TrendingUp" },
  { name: "Gifts", type: "income", color: "chart-5", icon: "Gift" },
  { name: "Other Income", type: "income", color: "chart-4", icon: "HandCoins" },
];

export const APP_NAME = "Ledgerly";
