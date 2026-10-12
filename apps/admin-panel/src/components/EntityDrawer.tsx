import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

type EntityDrawerProps<T> = {
  open: boolean;
  onClose: () => void;
  /** Undefined while loading. */
  entity: T | undefined;
  isError: boolean;
  errorMessage: string;
  title: ReactNode;
  description: ReactNode;
  editLabel: string;
  deleteLabel: string;
  onEdit: (entity: T) => void;
  onDelete: (entity: T) => void;
  /** Header actions that go before Edit, e.g. the service's status select. */
  actions?: (entity: T) => ReactNode;
  /** The body, rendered once the entity has loaded. */
  children: (entity: T) => ReactNode;
};

/** The side drawer one service, customer or device opens in. */
export function EntityDrawer<T>({
  open,
  onClose,
  entity,
  isError,
  errorMessage,
  title,
  description,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
  actions,
  children,
}: EntityDrawerProps<T>) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 sm:max-w-xl" showClose={false}>
        {/* The tint is painted over a solid background, so content scrolling under the strip stays hidden. */}
        <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center bg-background bg-[linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] px-4">
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">{t("Close")}</span>
            </Button>
          </SheetClose>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {/* The header actions are for the whole entity. */}
          <SheetHeader className="flex-row items-start justify-between gap-4 space-y-0 pr-0">
            <div className="space-y-1.5">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </div>
            {entity !== undefined && (
              <div className="flex shrink-0 items-center gap-2">
                {actions && (
                  <>
                    {actions(entity)}
                    <Separator orientation="vertical" className="h-5" />
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={editLabel}
                  title={editLabel}
                  onClick={() => onEdit(entity)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={deleteLabel}
                  title={deleteLabel}
                  onClick={() => onDelete(entity)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                </Button>
              </div>
            )}
          </SheetHeader>

          {isError ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : entity === undefined ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            children(entity)
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The `rounded-md` box of label/value rows at the top of a drawer's body. */
export function DrawerSummary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-muted/30 p-3 text-sm" aria-label={label}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">{children}</dl>
    </section>
  );
}

/** One label/value row of a `DrawerSummary`. */
export function DrawerSummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

/** A name in a drawer that opens its entity's own drawer on top. */
export function DrawerLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="font-medium text-primary hover:underline focus-visible:underline focus-visible:outline-none"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
