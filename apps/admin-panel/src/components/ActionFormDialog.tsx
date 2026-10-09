import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { actionInputSchema, type Action, type ActionInput } from "@servicebook/schemas";
import { useSaveActionMutation } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type ActionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The action to edit; omitted when creating one. */
  action?: Action;
  /** The name a new action starts with, e.g. what was searched for in a picker. */
  defaultName?: string;
  /** Called with the saved action, e.g. to pick an action created inline. */
  onSaved?: (action: Action) => void;
};

/** The price field starts empty when creating; the schema then rejects it. */
type ActionFormValues = { name: string; price: number | "" };

function toFormValues(action?: Action, defaultName = ""): ActionFormValues {
  return { name: action?.name ?? defaultName, price: action?.price ?? "" };
}

export function ActionFormDialog({
  open,
  onOpenChange,
  action,
  defaultName,
  onSaved,
}: ActionFormDialogProps) {
  const { t } = useTranslation();
  const saveAction = useSaveActionMutation();
  const isEdit = action !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<ActionFormValues, unknown, ActionInput>({
    // zodResolver submits the schema's parsed output, but @hookform/resolvers
    // v3 only types it as the input.
    resolver: zodResolver(actionInputSchema) as Resolver<ActionFormValues, unknown, ActionInput>,
  });

  useEffect(() => {
    if (open) reset(toFormValues(action, defaultName));
  }, [open, action, defaultName, reset]);

  function onSubmit(input: ActionInput) {
    saveAction.mutate(
      { id: action?.id, input },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          // With the name given, the price is what is left to fill in.
          if (!defaultName) return;
          event.preventDefault();
          setFocus("price");
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{isEdit ? t("Edit action") : t("New action")}</DialogTitle>
          <DialogDescription>{t("Fields marked with * are required.")}</DialogDescription>
        </DialogHeader>

        <form
          id="action-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          autoComplete="off"
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="action-name" className="text-sm font-medium">
              {t("Name", { context: "action" })} *
            </label>
            <Input
              id="action-name"
              aria-invalid={!!errors.name}
              className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
              {...register("name")}
            />
            {errors.name && <p className="text-sm text-destructive">{t("Enter a name")}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="action-price" className="text-sm font-medium">
              {t("Price (RSD)")} *
            </label>
            <Input
              id="action-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              aria-invalid={!!errors.price}
              className={cn(errors.price && "border-destructive focus-visible:ring-destructive")}
              {...register("price", { valueAsNumber: true })}
            />
            {errors.price && (
              <p className="text-sm text-destructive">{t("Enter a whole amount in dinars")}</p>
            )}
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="action-form" disabled={saveAction.isPending}>
            {saveAction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? t("Save changes") : t("Create action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
