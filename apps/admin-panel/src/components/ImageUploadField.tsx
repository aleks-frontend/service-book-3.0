import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

type ImageUploadFieldProps = {
  id: string;
  label: string;
  /** The image as a `data:` URL, or null when there is none. */
  value: string | null;
  /** The accepted media types, e.g. "image/png,image/jpeg". */
  accept: string;
  /** What may be uploaded, shown under the buttons. */
  hint: string;
  onChange: (value: string | null) => void;
  /** An already translated validation message. */
  error?: string;
};

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Picks one image, held as a `data:` URL, with a preview and a way to remove it. */
export function ImageUploadField({
  id,
  label,
  value,
  accept,
  hint,
  onChange,
  error,
}: ImageUploadFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    onChange(await readAsDataUrl(file));
    // Picking the same file again should still count as a change.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex h-32 items-center justify-center rounded-md border border-dashed bg-muted/30 p-2",
          error && "border-destructive",
        )}
      >
        {value ? (
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        aria-invalid={!!error}
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" aria-hidden />
          {value ? t("Replace") : t("Upload")}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            aria-label={t("Remove {{label}}", { label })}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            {t("Remove")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
