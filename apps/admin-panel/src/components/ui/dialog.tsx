import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Button } from "./button";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-[hsl(200_15%_7%/0.6)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-[80ms]",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** What the keyboard can reach, for picking where a modal opens. */
const TABBABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * The close button leads the tab order from the header, but a modal still opens on its
 * first field or button, as it did before. Returns false when there is none.
 */
function focusFirstAfterHeader(content: HTMLElement) {
  for (const element of content.querySelectorAll<HTMLElement>(TABBABLE)) {
    if (element.tabIndex < 0 || element.closest("[data-dialog-header]")) continue;
    if (!(element.checkVisibility?.() ?? true)) continue;
    element.focus();
    return true;
  }
  return false;
}

/**
 * A centred box of three rows: a `DialogHeader` and a `DialogFooter` that stay put, and a
 * `DialogBody` between them that is the only part that scrolls.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onOpenAutoFocus, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Dialogs cut in: a fast fade and no scale (ADR-0005). `dvh`, so a phone's address bar can't hide the footer.
        "fixed left-[50%] top-[50%] z-50 flex max-h-[90dvh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden border bg-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-[80ms] sm:rounded-lg",
        className,
      )}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented) return;
        if (
          event.currentTarget instanceof HTMLElement &&
          focusFirstAfterHeader(event.currentTarget)
        ) {
          event.preventDefault();
        }
      }}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * An ink header like the drawer's (without its yellow edge), holding the title, a form's
 * description and the close button. It stays put while the body scrolls; a confirm's text
 * goes in the `DialogBody` instead.
 */
const DialogHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const { t } = useTranslation();
  return (
    <div
      data-dialog-header=""
      className={cn(
        "dark flex shrink-0 items-start justify-between gap-4 bg-bar py-4 pl-6 pr-4 text-foreground",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1.5">{children}</div>
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <X className="h-5 w-5" aria-hidden />
          <span className="sr-only">{t("Close")}</span>
        </Button>
      </DialogPrimitive.Close>
    </div>
  );
};
DialogHeader.displayName = "DialogHeader";

/** The fields, or a confirm's text: the only part of a modal that scrolls. */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-dialog-body=""
    className={cn("min-h-0 flex-1 overflow-y-auto p-6", className)}
    {...props}
  />
);
DialogBody.displayName = "DialogBody";

/** The actions, ruled off from the body and always in view. */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-dialog-footer=""
    className={cn(
      "flex shrink-0 flex-col-reverse gap-2 border-t bg-card px-6 py-4 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-2xl font-extrabold leading-none", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
