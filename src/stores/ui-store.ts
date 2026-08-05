"use client";

import { create } from "zustand";
import type { Transaction, TxType } from "@/lib/types";

interface QuickAddState {
  open: boolean;
  /** Preset the ledger side when opening from an Income/Expense screen. */
  defaultType: TxType;
  /** When set, the sheet edits this transaction instead of creating one. */
  editing: Transaction | null;
  openCreate: (type?: TxType) => void;
  openEdit: (tx: Transaction) => void;
  close: () => void;
}

export const useQuickAdd = create<QuickAddState>((set) => ({
  open: false,
  defaultType: "expense",
  editing: null,
  openCreate: (type = "expense") => set({ open: true, defaultType: type, editing: null }),
  openEdit: (tx) => set({ open: true, editing: tx, defaultType: tx.type }),
  close: () => set({ open: false, editing: null }),
}));
