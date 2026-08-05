"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  MoreVertical,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryIcon } from "@/components/shared/category-icon";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryRepo } from "@/lib/repositories/categories";
import { useCategories, useTransactions } from "@/lib/hooks/use-data";
import { cn } from "@/lib/utils";
import type { Category, TxType } from "@/lib/types";

export default function CategoriesPage() {
  const categories = useCategories(true);
  const transactions = useTransactions({});
  const ready = categories !== undefined && transactions !== undefined;

  const [activeTab, setActiveTab] = useState<TxType>("expense");
  const [archivedOpen, setArchivedOpen] = useState<Record<TxType, boolean>>({
    expense: false,
    income: false,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const usageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tx of transactions ?? []) {
      counts[tx.categoryId] = (counts[tx.categoryId] ?? 0) + 1;
    }
    return counts;
  }, [transactions]);

  function openCreate(type: TxType) {
    setActiveTab(type);
    setEditingCategory(undefined);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setDialogOpen(true);
  }

  async function handleArchiveToggle(category: Category) {
    try {
      await categoryRepo.archive(category.id, !category.archived);
      toast.success(category.archived ? "Category unarchived" : "Category archived");
    } catch {
      toast.error("Couldn’t update that category. Please try again.");
    }
  }

  function toggleArchivedSection(type: TxType) {
    setArchivedOpen((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  function renderTab(type: TxType) {
    const all = categories ?? [];
    const active = all.filter((c) => c.type === type && !c.archived);
    const archived = all.filter((c) => c.type === type && c.archived);

    if (active.length === 0 && archived.length === 0) {
      return (
        <EmptyState
          icon={Tags}
          title={`No ${type} categories yet`}
          description={`Create your first ${type} category to start organizing transactions.`}
          action={
            <Button className="gap-2" onClick={() => openCreate(type)}>
              <Plus className="size-4" /> New category
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-6">
        {active.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {active.map((c) => (
              <CategoryCard
                key={c.id}
                category={c}
                count={usageCounts[c.id] ?? 0}
                onEdit={() => openEdit(c)}
                onArchiveToggle={() => void handleArchiveToggle(c)}
                onDelete={() => setDeleteTarget(c)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Tags}
            title={`No active ${type} categories`}
            description="Every category of this type is archived right now."
            action={
              <Button className="gap-2" onClick={() => openCreate(type)}>
                <Plus className="size-4" /> New category
              </Button>
            }
          />
        )}

        {archived.length > 0 ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => toggleArchivedSection(type)}
              aria-expanded={archivedOpen[type]}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  archivedOpen[type] ? "rotate-0" : "-rotate-90",
                )}
                aria-hidden
              />
              Archived ({archived.length})
            </button>
            {archivedOpen[type] ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {archived.map((c) => (
                  <CategoryCard
                    key={c.id}
                    category={c}
                    count={usageCounts[c.id] ?? 0}
                    archived
                    onEdit={() => openEdit(c)}
                    onArchiveToggle={() => void handleArchiveToggle(c)}
                    onDelete={() => setDeleteTarget(c)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organize income and expenses into categories you can budget and report on."
        actions={
          <Button className="gap-2" onClick={() => openCreate(activeTab)}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />

      {!ready ? (
        <CategoriesSkeleton />
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TxType)}>
          <TabsList>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>
          <TabsContent value="expense" className="pt-4">
            {renderTab("expense")}
          </TabsContent>
          <TabsContent value="income" className="pt-4">
            {renderTab("income")}
          </TabsContent>
        </Tabs>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingCategory(undefined);
        }}
        category={editingCategory}
      />

      {deleteTarget ? (
        <DeleteCategoryDialog
          category={deleteTarget}
          categories={categories ?? []}
          usage={usageCounts[deleteTarget.id] ?? 0}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          onDeleted={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}

interface CategoryCardProps {
  category: Category;
  count: number;
  archived?: boolean;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}

function CategoryCard({
  category,
  count,
  archived,
  onEdit,
  onArchiveToggle,
  onDelete,
}: CategoryCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-colors",
        archived && "bg-muted/40 opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <CategoryIcon icon={category.icon} color={category.color} size="lg" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${category.name}`}
              className="-mr-1.5 -mt-1"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchiveToggle}>
              {archived ? <ArchiveRestore /> : <Archive />}
              {archived ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{category.name}</p>
        <p className="text-xs text-muted-foreground">
          {count} transaction{count === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

interface DeleteCategoryDialogProps {
  category: Category;
  categories: Category[];
  usage: number;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

function DeleteCategoryDialog({
  category,
  categories,
  usage,
  onOpenChange,
  onDeleted,
}: DeleteCategoryDialogProps) {
  const [reassignTo, setReassignTo] = useState("");
  const [busy, setBusy] = useState(false);

  const reassignOptions = categories.filter(
    (c) => c.type === category.type && !c.archived && c.id !== category.id,
  );
  const needsReassign = usage > 0;
  const blocked = needsReassign && reassignOptions.length === 0;
  const canConfirm = !needsReassign || Boolean(reassignTo);

  async function handleConfirm() {
    setBusy(true);
    try {
      await categoryRepo.remove(category.id, needsReassign ? reassignTo : undefined);
      toast.success(`“${category.name}” deleted`);
      onDeleted();
    } catch {
      toast.error("Couldn’t delete that category. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {needsReassign
              ? `This category has ${usage} transaction${usage === 1 ? "" : "s"}. Choose where to move them before deleting it.`
              : "This action can’t be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {needsReassign ? (
          blocked ? (
            <p className="text-left text-sm text-destructive">
              There’s no other {category.type} category to move these transactions to. Create
              one first, then come back to delete this category.
            </p>
          ) : (
            <div className="space-y-1.5 text-left">
              <Label htmlFor="reassign-to">Move existing transactions to</Label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger id="reassign-to" className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {reassignOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || blocked || !canConfirm}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
