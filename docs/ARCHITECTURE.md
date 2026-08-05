# Ledgerly — Build Spec for Feature Pages (READ THIS ONLY; do not re-read foundation files)

Local-first expense tracker. Next.js 16 App Router, React 19, TypeScript (strict), Tailwind v4, shadcn/ui (radix), Dexie (IndexedDB), recharts 3, motion, sonner. Everything is client-side. Every page is a Client Component: start files with `"use client";`. Pages live at `src/app/(app)/<route>/page.tsx` and `export default` a component. Feature components go under `src/components/<feature>/`.

The app is already built and consistent. **Reuse the components below — do not reinvent them.** Match the existing visual language: `rounded-2xl`/`rounded-3xl` cards, `font-heading` on headings, `tabular-nums`/`tnum` on numbers, generous spacing, semantic colors. Support light + dark (tokens already handle it). Everything must be responsive (mobile-first) and accessible (labels, aria, keyboard). Provide **loading** (skeleton), **empty** (EmptyState), and graceful **no-data** states. NO placeholder/TODO text — ship complete, polished features.

## Currency & money
Never hardcode a currency symbol. Use `useMoney()` → `{ fmt, code }` and `fmt(amount, { compact?, signed? })`, or the `<Money>` component. Amounts are positive numbers in major units; `type` gives the sign.

## Domain types (`@/lib/types`)
```ts
type TxType = "income" | "expense";
type PaymentMethod = "cash"|"card"|"bank"|"wallet"|"other";
type CurrencyCode = "PKR"|"USD"|"EUR"|"GBP"|"INR"|"AED"|"SAR";
interface Category { id; name; type: TxType; color: string /* "chart-1".."chart-6" */; icon: string /* lucide name */; isDefault: boolean; archived: boolean; createdAt; updatedAt; }
interface Transaction { id; type: TxType; amount: number; categoryId; note; date /* "YYYY-MM-DD" */; method: PaymentMethod; createdAt; updatedAt; }
interface Budget { id; scope: "overall"|"category"; categoryId: string|null; amount: number; createdAt; updatedAt; }
interface AppSettings { id:"app"; name; currency: CurrencyCode; monthStartDay: number; pinEnabled: boolean; pinHash; pinSalt; hasCompletedSetup: boolean; createdAt; updatedAt; }
```

## Reactive hooks (`@/lib/hooks/use-data`) — use these in pages, they auto-refresh on data change
- `useSettings(): AppSettings | undefined`
- `useMoney(): { fmt: (n, opts?) => string; code: CurrencyCode; ready: boolean }`
- `useCategories(includeArchived=false): Category[] | undefined`
- `useTransactions(filter: TransactionFilter): Transaction[] | undefined`
- `useBudgets(): Budget[] | undefined`
- `useTransactionCount(): number | undefined`

`undefined` means still loading → show skeleton.

## Repositories (mutations; call then rely on hooks to refresh)
- `transactionRepo` (`@/lib/repositories/transactions`): `query(filter)`, `all()`, `get(id)`, `create(TransactionInput)`, `update(id, Partial<TransactionInput>)`, `remove(id)`, `bulkCreate(inputs)`, `count()`, `clearAll()`.
  `TransactionInput = { type; amount; categoryId; note; date; method }`.
  `TransactionFilter = { range?: DateRange; types?: TxType[]; categoryIds?: string[]; methods?: PaymentMethod[]; search?: string; min?: number; max?: number; sort?: TxSort }`.
  `TxSort = "date-desc"|"date-asc"|"amount-desc"|"amount-asc"`.
- `categoryRepo` (`@/lib/repositories/categories`): `list(includeArchived=false)`, `get(id)`, `create({name,type,color,icon})`, `update(id, patch)`, `usageCount(id)`, `remove(id, reassignToId?)` (throws if in use and no reassign target), `archive(id, archived=true)`.
- `budgetRepo` (`@/lib/repositories/budgets`): `list()`, `get(id)`, `upsert({scope, categoryId, amount})` (one overall max; one per category), `remove(id)`.
- `settingsRepo` (`@/lib/repositories/settings`): `get()`, `update(patch)`, `setPin(pin)`, `disablePin()`, `checkPin(pin)`.

## Analytics (`@/lib/analytics`) — pure functions
- `totals(txs): { income, expense, net, count }`
- `savingsRate(totals): number`
- `byCategory(txs, categories, type): CategorySlice[]` where `CategorySlice = { category?: Category; categoryId; total; count; pct }`
- `dailySeries(txs, range): { date; income; expense; net }[]`
- `monthlySeries(txs, range): { key; label; income; expense; net }[]`
- `byMethod(txs): { method; total; count; pct }[]`
- `budgetProgress(budgets, monthTxs, categories): BudgetProgress[]` where `BudgetProgress = { budget; category?; label; spent; limit; remaining; pct; status: "under"|"warning"|"over" }`
- `topTransactions(txs, type, n=5): Transaction[]`
- `pctChange(current, previous): number | null`

## Dates (`@/lib/dates`)
`DateRange = { start; end }` (ISO). `PRESETS: {key,label}[]`, `PresetKey`. Functions: `monthRange(ref: Date, monthStartDay=1)`, `shiftMonthRange(range, delta, monthStartDay=1)`, `presetRange(key, ref=new Date(), monthStartDay=1)`, `rangeLabel(range)`, `rangeDays(range)`, `inRange(iso, range)`, `daysInRange(range)`, `monthsInRange(range)`, `monthKey(iso)`, `monthKeyLabel(key)`.

## Format (`@/lib/format`)
`formatCurrency(n, code, opts)`, `formatCompact(n, code)`, `parseMoneyInput(str): number|null`, `formatDate(iso, "short"|"medium"|"long")`, `relativeDay(iso)`, `todayISO()`, `toISODate(date)`, `formatPercent(n, digits=0)`, `sumMoney(nums)`, `roundMoney(n)`.

## Shared components
- `PageHeader` (`@/components/shared/page-header`): `{ title, description?, actions? }`. Use at top of every page.
- `SectionCard` (`@/components/shared/section-card`): `{ title?, description?, action?, href?, hrefLabel?, children, className?, bodyClassName? }`. Panel wrapper.
- `StatCard` (`@/components/shared/stat-card`): `{ label, value: ReactNode, icon: LucideIcon, accent?: string /* palette token or "income"/"expense" */, delta?: number|null, invertDelta?: boolean, hint?: string }`.
- `EmptyState` (`@/components/shared/empty-state`): `{ icon: LucideIcon, title, description?, action? }`.
- `states` (`@/components/shared/states`): `ErrorState`, `LoadingPanel({rows})`, `StatCardsSkeleton({count})`.
- `Money` (`@/components/shared/money`): `{ amount, tone?: TxType|"net"|"plain", signed?, compact?, className? }`.
- `CategoryIcon` (`@/components/shared/category-icon`): `{ icon, color, size?: "sm"|"md"|"lg" }`.
- `MoneyInput` (`@/components/shared/money-input`): `{ value: number|null, onChange: (n|null)=>void, size?: "md"|"lg", id?, autoFocus? }`.
- `DateField` (`@/components/shared/date-field`): `{ value: iso, onChange: (iso)=>void, disableFuture? }`.
- `TypeToggle` (`@/components/shared/type-toggle`): `{ value: TxType, onChange }`.
- `MonthSwitcher` & `PresetSelect` (`@/components/shared/period-controls`): `MonthSwitcher {range,onChange,monthStartDay?}`, `PresetSelect {value: PresetKey, onChange}`.
- `TransactionList` (`@/components/transactions/transaction-list`): `{ transactions: Transaction[], categories: Category[], grouped?: boolean }`. Handles edit (opens quick-add) + delete + undo internally.
- `CategorySelect` (`@/components/transactions/category-select`): `{ type: TxType, value, onChange, includeAll? }`.
- `CashflowChart` (`@/components/charts/cashflow-chart`): `{ data: {label,income,expense}[], variant?: "area"|"bar", height?, series?: ("income"|"expense")[] }`.
- `CategoryDonut` (`@/components/charts/category-donut`): `{ slices: CategorySlice[], total, centerLabel?, maxLegend? }`.

## Stores
- `useQuickAdd` (`@/stores/ui-store`): `openCreate(type?: TxType)`, `openEdit(tx)`, `close()`. Use `openCreate("income")` etc. to launch the global add/edit sheet. Do NOT build your own transaction form.
- `useLockStore` (`@/stores/lock-store`): `{ unlocked, unlock(), lock() }`.

## Constants (`@/lib/constants`)
`CURRENCIES` (record), `CURRENCY_LIST` (`Currency[]` with `{code,symbol,name,decimals,locale}`), `PAYMENT_METHODS` (`{value,label,icon}[]`), `CATEGORY_COLORS` (`readonly ["chart-1"..]`), `CATEGORY_ICONS` (`readonly string[]` of lucide names), `DEFAULT_CATEGORIES`, `APP_NAME`.

## Icons
`resolveIcon(name): LucideIcon` from `@/lib/icon-map` (curated set = CATEGORY_ICONS + payment icons). For category pickers iterate `CATEGORY_ICONS`. Import nav/action icons directly from `lucide-react`.

## Backup / import-export (`@/lib/backup`)
`exportBackupJSON(): Promise<string>`, `importBackupJSON(text): Promise<{categories,transactions,budgets}>`, `exportTransactionsCSV(): Promise<string>`, `importTransactionsCSV(text): Promise<{imported,skipped,createdCategories}>`, `clearAllData(): Promise<void>`. From `@/lib/csv`: `downloadFile(filename, content, mime)`, `toCSV`, `parseCSV`.

## shadcn/ui (`@/components/ui/<name>`)
Available: button, card, input, label, select, dialog, dropdown-menu, tabs, badge, separator, sheet, tooltip, table, progress, switch, checkbox, popover, skeleton, scroll-area, alert, alert-dialog, command, textarea, slider, radio-group, avatar, calendar. Toasts: `import { toast } from "sonner"`. There is NO `form` component — use `react-hook-form` + `@hookform/resolvers/zod` + `Controller` directly if you need a form (see existing schemas in `@/lib/schemas`: `categorySchema`/`CategoryFormValues`, `budgetSchema`/`BudgetFormValues`).

`cn` from `@/lib/utils`.

## Semantic color classes (already defined)
Text: `text-income`, `text-expense`, `text-savings`, `text-info`, `text-primary`, `text-muted-foreground`. Backgrounds: `bg-income-soft`, `bg-expense-soft`, `bg-savings-soft`, `bg-accent`, `bg-muted`, `bg-card`. Chart tokens for inline styles: `var(--chart-1)`..`var(--chart-6)`, `var(--income)`, `var(--expense)`.

## Quality bar
Strict TypeScript (no `any` unless unavoidable; no unused vars/imports — this project lints with `eslint-config-next` and unused vars fail). Self-contained, no external network. Verify your page against these exact prop names. Keep imports tidy.

---

## Extended features (added after the initial build)

### People & Debts (`/people`)
Track money lent to / borrowed from individuals, separate from income/expense.
- Types (`@/lib/types`): `Person`, `DebtEntry`, `DebtKind = "lent"|"received"|"borrowed"|"repaid"` (lent = you gave; received = they repaid; borrowed = you took; repaid = you paid back).
- Repos (`@/lib/repositories/people`): `peopleRepo` (`list/get/create/update/remove`), `debtRepo` (`all/listByPerson/create/update/remove`).
- Hooks: `usePeople()`, `useDebtEntries()`, `useDebtEntriesByPerson(id)`.
- Analytics (`@/lib/debts`): `balanceOf(entries)` (positive = they owe you), `summarizePeople(people, entries) → { summaries, owedToYou, youOwe, net }`, `entryDelta`, `debtKindLabel`.
- Schemas: `personSchema`, `debtEntrySchema`.

### Savings Goals (`/savings`)
- Types: `SavingsGoal` (`name, target, note, color, icon, targetDate`), `SavingsContribution` (`goalId, amount` [+add / −withdraw], `note, date`).
- Repos (`@/lib/repositories/savings`): `savingsGoalRepo`, `contributionRepo`.
- Hooks: `useSavingsGoals()`, `useSavingsContributions()`, `useContributionsByGoal(id)`.
- Analytics (`@/lib/savings`): `summarizeGoals(goals, contributions) → { progress, totalSaved, totalTarget, overallPct }`, `savedForGoal`.
- Schemas: `savingsGoalSchema`, `contributionSchema`.

### Cloud sync (Neon Postgres, optional, two-way LWW)
- All synced entities extend `Syncable` (`createdAt/updatedAt/deletedAt`). Deletes are **soft-delete tombstones**; every repo read filters `deletedAt`, and `remove()` sets it so deletions propagate.
- Collections listed in `@/lib/sync/types.ts` (`SYNC_COLLECTIONS`). Server routes: `GET/POST /api/sync` and `GET /api/sync/status` (`@/lib/server/neon.ts`, server-only `DATABASE_URL`).
- Client: `@/lib/sync/engine.ts` (`syncNow`, `fetchSyncConfigured`), `@/stores/sync-store.ts` (`useSyncStore`), `<SyncProvider/>` (auto-sync on load / online / focus / interval / local write, debounced). `lib/db/database.ts` fires change hooks (`subscribeLocalChange`, `withoutChangeEvents`).
- Default category IDs are **deterministic** (`default-<type>-<slug>`, see `seed.ts`) so devices converge instead of duplicating on sync.
- Time helpers: `timeAgo(iso)`, `formatClock(iso)` (`@/lib/format`); `useNow(ms)` (`@/lib/hooks/use-now`) for live "time ago".

### App lock (mandatory PIN via env)
- `APP_PIN` (server-only env) → validated at `GET/POST /api/lock`. Same PIN on every device; not set in-app. Client helpers in `@/lib/auth-client.ts` (`fetchPinRequired`, `verifyAppPin`). `AppGate` gates on it; `useLockStore.pinRequired` drives the lock buttons. `PinPad` (`@/components/auth/pin-pad`) is the keypad.
- `clearAllData()` (`@/lib/backup`, Settings danger zone) soft-deletes ALL financial collections and syncs the tombstones.
- Import/export: `exportBackupJSON`, `importBackupJSON`, `exportTransactionsCSV(range?)`, `importTransactionsCSV`, `clearAllData` (`@/lib/backup`); `downloadFile` (`@/lib/csv`).
