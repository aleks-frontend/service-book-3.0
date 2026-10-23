import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

/** Where a drawer sits in the stack, and how it leaves it. */
export type DrawerPlace = {
  /** Closes this drawer only: Escape, the backdrop and the back button. */
  onClose: () => void;
  /** Closes every drawer: the X. */
  onCloseAll: () => void;
  /** The title of the drawer below, when this is the top one of several. */
  backTo?: string;
  /** Over another drawer, whose backdrop already dims the page. */
  stacked: boolean;
};

type EntityDrawerProps<T> = DrawerPlace & {
  open: boolean;
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
  onCloseAll,
  backTo,
  stacked,
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
      <SheetContent className="gap-0 p-0 sm:max-w-xl" showClose={false} dimmed={!stacked}>
        {/*
          An ink header, like the app's bar, that stays put while the body scrolls under it.
          The header actions are for the whole entity.
        */}
        <SheetHeader className="dark sticky top-0 z-10 flex-row flex-wrap items-start justify-between gap-x-4 gap-y-3 space-y-0 bg-bar py-4 pl-6 pr-4 text-foreground">
          <div className="flex min-w-0 items-start gap-2">
            {backTo !== undefined && (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 h-8 w-8 shrink-0"
                aria-label={t("Back to {{name}}", { name: backTo })}
                title={t("Back to {{name}}", { name: backTo })}
                onClick={onClose}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
            )}
            <div className="min-w-0 space-y-1.5">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {entity !== undefined && (
              <>
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
                <Separator orientation="vertical" className="h-5" />
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCloseAll}>
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">{t("Close")}</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-6">
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

/** The label/value rows at the top of a drawer's body, ruled off from each other. */
export function DrawerSummary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="-mx-6 -mt-6 border-b text-sm" aria-label={label}>
      <dl className="grid grid-cols-[auto_1fr] [&>*:nth-child(-n+2)]:border-t-0 [&>*]:border-t [&>*]:py-2 [&>dd]:pr-6 [&>dt]:pl-6">
        {children}
      </dl>
    </section>
  );
}

/** One label/value row of a `DrawerSummary`. */
export function DrawerSummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pr-4 text-muted-foreground">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

/** A name in a drawer that opens its entity's own drawer on top. */
export function DrawerLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="font-medium text-link" onClick={onClick}>
      {children}
    </button>
  );
}
