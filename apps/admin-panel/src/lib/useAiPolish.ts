import { useRef, useState, type RefObject } from "react";
import type { CustomerReportPolish } from "@servicebook/schemas";
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
 * AI polish (GLOSSARY.md) of a customer report textarea. The polished text
 * replaces the draft as a native edit, so Ctrl+Z (⌘+Z) undoes it where the browser
 * supports that; `undo` restores the text from just before the latest polish
 * anywhere. Nothing is saved: the host saves as usual, and disables its save
 * actions while `isPolishing`. Its textarea is read-only meanwhile, and calls
 * `onEdit` on every change and `reset` once saved.
 */
export function useAiPolish({ serviceId, textareaRef, text, setText }: UseAiPolishOptions) {
  const { data: me } = useMeQuery();
  const enabled = me?.features.aiPolish ?? false;
  const mutation = usePolishCustomerReportMutation(serviceId);
  // The text from just before the latest polish, while it can be undone.
  const [beforePolish, setBeforePolish] = useState<string | null>(null);
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
    let result: CustomerReportPolish;
    try {
      result = await mutation.mutateAsync(draft);
    } catch {
      // The draft is left exactly as it was.
      return;
    }
    if (result.changed && replaceText(result.text)) setBeforePolish(draft);
  }

  function undo() {
    if (beforePolish !== null && replaceText(beforePolish)) setBeforePolish(null);
  }

  return {
    /** Whether this deployment offers AI polish; without it, nothing is shown. */
    enabled,
    isPolishing,
    canPolish,
    /** Whether the latest polish can still be undone from the bar. */
    isPolished: beforePolish !== null,
    polish,
    undo,
    /** The user changed the text: the polish is now built on, so it can't be undone from the bar. */
    onEdit: () => {
      if (!replacing.current) setBeforePolish(null);
    },
    /** The text was saved. */
    reset: () => setBeforePolish(null),
  };
}

export type AiPolish = ReturnType<typeof useAiPolish>;
