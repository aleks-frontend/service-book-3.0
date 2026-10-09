import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ArrowDown, ArrowUp, Loader2, Package, Plus, Trash2, Wrench } from "lucide-react";
import {
  lineQuantitySchema,
  linesTotal,
  rsdAmountSchema,
  type Action,
  type DeviceSummary,
  type LineType,
  type ServiceDetail,
  type ServiceLine,
} from "@servicebook/schemas";
import { formatRsd } from "@/lib/format";
import { useServiceLineMutations } from "@/lib/services";
import { cn } from "@/lib/utils";
import { ActionPicker } from "./ActionPicker";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { DevicePicker } from "./DevicePicker";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

/** A quantity or unit price as typed, or null while it is not a valid one. */
function parseWhole(schema: z.ZodType<number>, text: string) {
  const parsed = schema.safeParse(text.trim() === "" ? NaN : Number(text));
  return parsed.success ? parsed.data : null;
}

const parseQuantity = (text: string) => parseWhole(lineQuantitySchema, text);
const parsePrice = (text: string) => parseWhole(rsdAmountSchema, text);

/** A whole number typed into a text field; blank is not zero. */
function typedWhole(schema: z.ZodType<number>) {
  return z.preprocess((text) => (String(text).trim() === "" ? NaN : Number(text)), schema);
}

/** The new line's quantity and unit price, as typed; the action or device is picked beside them. */
const addLineSchema = z.object({
  quantity: typedWhole(lineQuantitySchema),
  unitPrice: typedWhole(rsdAmountSchema),
});

type AddLineValues = { quantity: string; unitPrice: string };
type AddLineAmounts = z.output<typeof addLineSchema>;

const EMPTY_LINE: AddLineValues = { quantity: "1", unitPrice: "" };

/** What is typed into a line's quantity and unit price but not yet saved. */
type Draft = { quantity: string; unitPrice: string };

type ServiceLinesProps = {
  service: ServiceDetail;
};

/**
 * The work and sale lines of a service and its total. Quantities and prices
 * are edited in place and saved when the field loses focus; the total follows
 * every keystroke.
 */
export function ServiceLines({ service }: ServiceLinesProps) {
  const { t, i18n } = useTranslation();
  const { add, update, remove, reorder } = useServiceLineMutations(service.id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [adding, setAdding] = useState(false);

  /** The line as it would be saved now: valid drafts count, invalid ones do not. */
  function current(line: ServiceLine) {
    const draft = drafts[line.id];
    return {
      quantity: (draft && parseQuantity(draft.quantity)) ?? line.quantity,
      unitPrice: (draft && parsePrice(draft.unitPrice)) ?? line.unitPrice,
    };
  }

  function edit(line: ServiceLine, change: Partial<Draft>) {
    setDrafts((previous) => ({
      ...previous,
      [line.id]: {
        ...(previous[line.id] ?? {
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
        }),
        ...change,
      },
    }));
  }

  /** Drops the line's draft, unless it has been edited again since `draft` was taken. */
  function discardDraft(lineId: string, draft = drafts[lineId]) {
    setDrafts((previous) => {
      if (previous[lineId] !== draft) return previous;
      const rest = { ...previous };
      delete rest[lineId];
      return rest;
    });
  }

  /** Saves a valid, changed draft; an invalid one is dropped, showing the saved values again. */
  function save(line: ServiceLine) {
    const draft = drafts[line.id];
    if (!draft) return;
    const quantity = parseQuantity(draft.quantity);
    const unitPrice = parsePrice(draft.unitPrice);
    if (quantity === null || unitPrice === null) {
      discardDraft(line.id);
      return;
    }
    if (quantity === line.quantity && unitPrice === line.unitPrice) {
      discardDraft(line.id);
      return;
    }
    // The draft stays until the service is refetched, so the old values never flash back;
    // whatever is typed meanwhile is kept for the next save.
    update.mutate(
      { lineId: line.id, input: { quantity, unitPrice } },
      { onSettled: () => discardDraft(line.id, draft) },
    );
  }

  /** Enter saves by leaving the field, so the blur does not save a second time. */
  function saveOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
  }

  function move(index: number, by: -1 | 1) {
    const ids = service.lines.map(({ id }) => id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    reorder.mutate(ids);
  }

  const total = linesTotal(service.lines.map(current));

  return (
    <section className="space-y-3" aria-labelledby="service-lines-heading">
      <h3 id="service-lines-heading" className="text-sm font-medium">
        {t("Work and sales")}
      </h3>

      {service.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("No work or sales recorded yet.")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {service.lines.map((line, index) => {
            const draft = drafts[line.id];
            const quantityText = draft?.quantity ?? String(line.quantity);
            const priceText = draft?.unitPrice ?? String(line.unitPrice);
            const { quantity, unitPrice } = current(line);
            const Icon = line.type === "WORK" ? Wrench : Package;
            return (
              <li key={line.id} className="space-y-2 p-3" data-testid="service-line">
                <div className="flex items-start gap-2">
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-label={line.type === "WORK" ? t("Work") : t("Sale")}
                  />
                  <span className="flex-1 text-sm font-medium">{line.label}</span>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={t("Move up")}
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={t("Move down")}
                      disabled={index === service.lines.length - 1 || reorder.isPending}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={t("Remove line")}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(line.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-6 text-sm">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    aria-label={t("Quantity")}
                    aria-invalid={parseQuantity(quantityText) === null}
                    className={cn(
                      "h-8 w-20",
                      parseQuantity(quantityText) === null && "border-destructive",
                    )}
                    value={quantityText}
                    onChange={(event) => edit(line, { quantity: event.target.value })}
                    onBlur={() => save(line)}
                    onKeyDown={saveOnEnter}
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    aria-label={t("Unit price (RSD)")}
                    aria-invalid={parsePrice(priceText) === null}
                    className={cn(
                      "h-8 w-28",
                      parsePrice(priceText) === null && "border-destructive",
                    )}
                    value={priceText}
                    onChange={(event) => edit(line, { unitPrice: event.target.value })}
                    onBlur={() => save(line)}
                    onKeyDown={saveOnEnter}
                  />
                  <span className="ml-auto font-medium tabular-nums">
                    {formatRsd(quantity * unitPrice, i18n.language)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* New lines go last, so they are added from below the list. */}
      <Button variant="outline" className="w-full border-dashed" onClick={() => setAdding(true)}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />
        {t("Add line")}
      </Button>

      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="font-medium">{t("Total")}</span>
        <span className="text-lg font-semibold tabular-nums" data-testid="service-total">
          {formatRsd(total, i18n.language)}
        </span>
      </div>

      <AddLineDialog
        open={adding}
        onOpenChange={setAdding}
        service={service}
        isAdding={add.isPending}
        onAdd={add.mutateAsync}
      />
    </section>
  );
}

type AddLineDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceDetail;
  isAdding: boolean;
  onAdd: ReturnType<typeof useServiceLineMutations>["add"]["mutateAsync"];
};

/** Adds a work line (an action, at its price unless changed) or a sale line (a device). */
function AddLineDialog({ open, onOpenChange, service, isAdding, onAdd }: AddLineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {/* Mounted with the dialog, so every line starts from a blank form. */}
        <AddLineForm
          service={service}
          isAdding={isAdding}
          onAdd={onAdd}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

type AddLineFormProps = Omit<AddLineDialogProps, "open" | "onOpenChange"> & {
  onDone: () => void;
};

function AddLineForm({ service, isAdding, onAdd, onDone }: AddLineFormProps) {
  const { t, i18n } = useTranslation();
  const [type, setType] = useState<LineType>("WORK");
  // The form only holds the amounts; the pickers hold what the line refers to.
  const [action, setAction] = useState<Action | null>(null);
  const [device, setDevice] = useState<DeviceSummary | null>(null);
  const [creatingDevice, setCreatingDevice] = useState(false);

  const { register, handleSubmit, setValue, watch, formState } = useForm<
    AddLineValues,
    unknown,
    AddLineAmounts
  >({
    // zodResolver submits the schema's parsed output, but @hookform/resolvers
    // v3 only types it as the input.
    resolver: zodResolver(addLineSchema) as Resolver<AddLineValues, unknown, AddLineAmounts>,
    defaultValues: EMPTY_LINE,
    mode: "onChange",
  });

  const quantity = parseQuantity(watch("quantity"));
  const unitPrice = parsePrice(watch("unitPrice"));
  const picked = type === "WORK" ? action : device;

  function setPrice(price: number | null) {
    setValue("unitPrice", price === null ? "" : String(price), { shouldValidate: true });
  }

  function changeType(next: LineType) {
    setType(next);
    setPrice(next === "WORK" && action ? action.price : null);
  }

  function pickAction(next: Action | null) {
    setAction(next);
    // The line starts at the action's price, which can then be changed.
    setPrice(next?.price ?? null);
  }

  async function submit(amounts: AddLineAmounts) {
    const input =
      type === "WORK"
        ? action && { type: "WORK" as const, actionId: action.id, ...amounts }
        : device && { type: "SALE" as const, deviceId: device.id, ...amounts };
    if (!input) return;
    try {
      await onAdd(input);
      onDone();
    } catch {
      // The mutation already showed the error; keep what was typed.
    }
  }

  const typeButtonClass = (option: LineType) =>
    cn(
      "rounded-sm px-3 py-1 text-sm transition-colors",
      type === option ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
    );

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle>{t("Add a line")}</DialogTitle>
        <DialogDescription>
          {t("Work from the price list, or a device sold to the customer.")}
        </DialogDescription>
      </DialogHeader>

      <form
        id="add-line-form"
        onSubmit={handleSubmit(submit)}
        noValidate
        autoComplete="off"
        className="space-y-4"
      >
        <div className="inline-flex rounded-md bg-muted p-1" role="group">
          <button
            type="button"
            className={typeButtonClass("WORK")}
            aria-pressed={type === "WORK"}
            onClick={() => changeType("WORK")}
          >
            {t("Work")}
          </button>
          <button
            type="button"
            className={typeButtonClass("SALE")}
            aria-pressed={type === "SALE"}
            onClick={() => changeType("SALE")}
          >
            {t("Sale")}
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="add-line-reference" className="text-sm font-medium">
              {type === "WORK" ? t("Action") : t("Device sold")} *
            </label>
            {type === "SALE" && (
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => setCreatingDevice(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t("New device")}
              </Button>
            )}
          </div>
          {type === "WORK" ? (
            <ActionPicker
              id="add-line-reference"
              value={action}
              onChange={pickAction}
              placeholder={t("Search the price list")}
            />
          ) : (
            <DevicePicker
              id="add-line-reference"
              customerId={service.customer.id}
              value={device}
              onChange={setDevice}
              placeholder={t("The customer's or generic devices")}
            />
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="add-line-quantity" className="text-sm font-medium">
              {t("Quantity")} *
            </label>
            <Input
              id="add-line-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              aria-invalid={!!formState.errors.quantity}
              className={cn("w-24", formState.errors.quantity && "border-destructive")}
              {...register("quantity")}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="add-line-price" className="text-sm font-medium">
              {t("Unit price (RSD)")} *
            </label>
            <Input
              id="add-line-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="w-32"
              {...register("unitPrice")}
            />
          </div>
          <p className="ml-auto pb-2 text-sm">
            <span className="text-muted-foreground">{t("Total")}: </span>
            <span className="font-medium tabular-nums">
              {formatRsd((quantity ?? 0) * (unitPrice ?? 0), i18n.language)}
            </span>
          </p>
        </div>
      </form>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone}>
          {t("Cancel")}
        </Button>
        <Button
          type="submit"
          form="add-line-form"
          disabled={!picked || !formState.isValid || isAdding}
        >
          {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("Add line")}
        </Button>
      </DialogFooter>

      {/* Outside the form: a nested dialog's submit would otherwise bubble up to it through the React tree. */}
      <DeviceFormDialog
        open={creatingDevice}
        onOpenChange={setCreatingDevice}
        // Devices sold are usually generic (see GLOSSARY.md), but may be made the customer's.
        defaultOwner={null}
        onSaved={({ id, manufacturer, model, serialNumber, owner }) => {
          // The owner may have been changed to someone else in the dialog.
          if (owner && owner.id !== service.customer.id) return;
          setDevice({ id, manufacturer, model, serialNumber, owner });
        }}
      />
    </>
  );
}
