"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TypeToggle } from "@/components/shared/type-toggle";
import { CategoryIcon } from "@/components/shared/category-icon";
import { ColorPicker } from "./color-picker";
import { IconPicker } from "./icon-picker";
import { categoryRepo } from "@/lib/repositories/categories";
import { categorySchema, type CategoryFormValues } from "@/lib/schemas";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/constants";
import type { Category } from "@/lib/types";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this category instead of creating one. */
  category?: Category;
}

function fieldError(msg?: string) {
  return msg ? <p role="alert" className="text-xs font-medium text-destructive">{msg}</p> : null;
}

function defaultsFor(category?: Category): CategoryFormValues {
  return {
    name: category?.name ?? "",
    type: category?.type ?? "expense",
    color: category?.color ?? CATEGORY_COLORS[0],
    icon: category?.icon ?? CATEGORY_ICONS[0],
  };
}

/** Create/edit dialog for a category: name, type, color, and icon, with a live preview. */
export function CategoryDialog({ open, onOpenChange, category }: CategoryDialogProps) {
  const isEdit = Boolean(category);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaultsFor(category),
  });

  // Reset only when the dialog opens or the target changes (keyed by id), not
  // on every `category` object-identity change — matches person/goal dialogs.
  useEffect(() => {
    if (open) reset(defaultsFor(category));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.id]);

  const name = useWatch({ control, name: "name" });
  const color = useWatch({ control, name: "color" });
  const icon = useWatch({ control, name: "icon" });

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (category) {
        await categoryRepo.update(category.id, values);
        toast.success("Category updated");
      } else {
        await categoryRepo.create(values);
        toast.success("Category created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn’t save. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the name, type, color, or icon."
              : "Add a category to organize your transactions."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            <CategoryIcon icon={icon} color={color} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {name || "Category name"}
              </p>
              <p className="text-xs text-muted-foreground">Live preview</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              placeholder="e.g. Groceries"
              {...register("name")}
              aria-invalid={!!errors.name}
              autoFocus
            />
            {fieldError(errors.name?.message)}
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => <TypeToggle value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
