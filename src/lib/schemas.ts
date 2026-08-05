import { z } from "zod";

export const txTypeSchema = z.enum(["income", "expense"]);
export const methodSchema = z.enum(["cash", "card", "bank", "wallet", "other"]);

export const transactionSchema = z.object({
  type: txTypeSchema,
  amount: z
    .number({ message: "Enter an amount" })
    .positive("Amount must be greater than zero")
    .max(1_000_000_000, "That amount looks too large"),
  categoryId: z.string().min(1, "Pick a category"),
  note: z.string().max(140, "Keep the note under 140 characters"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
  method: methodSchema,
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(30, "Keep it under 30 characters"),
  type: txTypeSchema,
  color: z.string().min(1),
  icon: z.string().min(1),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const budgetSchema = z.object({
  scope: z.enum(["overall", "category"]),
  categoryId: z.string().nullable(),
  amount: z.number().positive("Set a limit greater than zero"),
});

export type BudgetFormValues = z.infer<typeof budgetSchema>;

export const personSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Keep it under 40 characters"),
  note: z.string().max(140, "Keep the note under 140 characters").optional(),
});

export type PersonFormValues = z.infer<typeof personSchema>;

export const debtEntrySchema = z.object({
  personId: z.string().min(1, "Choose a person"),
  kind: z.enum(["lent", "received", "borrowed", "repaid"]),
  amount: z.number().positive("Enter an amount greater than zero").max(1_000_000_000),
  note: z.string().max(140, "Keep the note under 140 characters").optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
});

export type DebtEntryFormValues = z.infer<typeof debtEntrySchema>;

export const savingsGoalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Keep it under 40 characters"),
  target: z.number().positive("Set a target greater than zero").max(1_000_000_000),
  note: z.string().max(140, "Keep the note under 140 characters").optional(),
  color: z.string().min(1),
  icon: z.string().min(1),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
    .nullable()
    .optional(),
});

export type SavingsGoalFormValues = z.infer<typeof savingsGoalSchema>;

export const contributionSchema = z.object({
  goalId: z.string().min(1, "Choose a goal"),
  amount: z
    .number()
    .gte(-1_000_000_000, "That amount looks too large")
    .lte(1_000_000_000, "That amount looks too large")
    .refine((n) => n !== 0, "Enter an amount"),
  note: z.string().max(140, "Keep the note under 140 characters").optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date"),
});

export type ContributionFormValues = z.infer<typeof contributionSchema>;
