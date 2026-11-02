import { useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { AiPolishError, CustomerReportPolish } from "@servicebook/schemas";
import type { HttpError } from "./http";
import { usePolishCustomerReportMutation } from "./services";
import { useMeQuery } from "./useMeQuery";

type UseAiPolishOptions = {
  serviceId: string;
  /** The customer report's textarea, whose text a polish replaces. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** The text in the textarea now. */
  text: string;
  /**
   * Sets the text where the browser can't insert it as a native edit. The host
   * must count it as a change (e.g. mark its form dirty).
   */
  setText: (text: string) => void;
};

/**
 * What the latest polish did: replaced the text (undoable to `beforePolish`),
 * found nothing to change, or nothing to show (none yet, or since edited or saved).
 */
type PolishOutcome =
  { kind: "none" } | { kind: "polished"; beforePolish: string } | { kind: "unchanged" };

/**
 * AI polish (GLOSSARY.md) of a customer report textarea. The polished text
 * replaces the draft as a native edit, so Ctrl+Z (⌘+Z) undoes it where the browser
 * supports that; `undo` restores the text from just before the latest polish
 * anywhere. A polish that changes nothing, or fails, leaves the text alone: the
 * first says so in a note, the second in a toast. Nothing is saved: the host
 * saves as usual, and disables its save actions while `isPolishing`. Its textarea is read-only meanwhile, and calls
 * `onEdit` on every change and `reset` once saved.
 */
export function useAiPolish({ serviceId, textareaRef, text, setText }: UseAiPolishOptions) {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const enabled = me?.features.aiPolish ?? false;
  const mutation = usePolishCustomerReportMutation(serviceId);
  // What the latest polish did, until the next edit, polish or save.
  const [outcome, setOutcome] = useState<PolishOutcome>({ kind: "none" });
  // Set while the hook itself changes the text, so the change isn't taken for the user's.
  const replacing = useRef(false);

  const isPolishing = mutation.isPending;
  const canPolish = enabled && !isPolishing && text.trim() !== "";

  /**
   * Replaces the whole text as one native edit, falling back to setting it.
   * False when there is no textarea (e.g. it unmounted while polishing).
   */
  function replaceText(next: string) {
    const textarea = textareaRef.current;
    if (!textarea) return false;
    replacing.current = true;
    try {
      // Still read-only from the polish until React re-renders, and a read-only
      // textarea takes no edits.
      textarea.readOnly = false;
      textarea.focus();
      textarea.select();
      const inserted = document.execCommand("insertText", false, next);
      if (!inserted || textarea.value !== next) setText(next);
      return true;
    } finally {
      replacing.current = false;
    }
  }

  async function polish() {
    if (!canPolish) return;
    const draft = text;
    setOutcome({ kind: "none" });
    let result: CustomerReportPolish;
    try {
      result = await mutation.mutateAsync(draft);
    } catch (error) {
      // The draft is left exactly as it was.
      const dailyLimit = ((error as HttpError).details as Partial<AiPolishError> | undefined)
        ?.dailyLimit;
      const message = t("AI polish is unavailable right now. Try again later.");
      toast.error(dailyLimit ? `${message} ${t("(daily limit reached)")}` : message);
      return;
    }
    if (!result.changed) setOutcome({ kind: "unchanged" });
    else if (replaceText(result.text)) setOutcome({ kind: "polished", beforePolish: draft });
  }

  function undo() {
    if (outcome.kind === "polished" && replaceText(outcome.beforePolish)) {
      setOutcome({ kind: "none" });
    }
  }

  return {
    /** Whether this deployment offers AI polish; without it, nothing is shown. */
    enabled,
    isPolishing,
    canPolish,
    /** Whether the latest polish can still be undone from the bar. */
    isPolished: outcome.kind === "polished",
    /** Whether the latest polish found nothing to change. */
    isUnchanged: outcome.kind === "unchanged",
    polish,
    undo,
    /** The user changed the text: the polish is now built on, so it can't be undone from the bar. */
    onEdit: () => {
      if (!replacing.current) setOutcome({ kind: "none" });
    },
    /** The text was saved. */
    reset: () => setOutcome({ kind: "none" }),
  };
}

export type AiPolish = ReturnType<typeof useAiPolish>;
