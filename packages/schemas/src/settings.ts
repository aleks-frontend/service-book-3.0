import { z } from "zod";
import { optionalEmail, optionalText } from "./fields.js";

/** The image types documents can embed. */
export const SETTINGS_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;
export type SettingsImageType = (typeof SETTINGS_IMAGE_TYPES)[number];

/** The largest logo or signature, decoded. */
export const SETTINGS_IMAGE_MAX_BYTES = 1024 * 1024;

const DATA_URL_RE = new RegExp(
  `^data:(${SETTINGS_IMAGE_TYPES.join("|")});base64,([A-Za-z0-9+/]+={0,2})$`,
);

/** How each type's content starts once base64-encoded: its file signature (magic number). */
const BASE64_SIGNATURES: Record<SettingsImageType, string> = {
  "image/png": "iVBORw0KGgo",
  "image/jpeg": "/9j/",
};

/** An image `data:` URL split into its media type and base64 content, or null if it is not one. */
export function parseImageDataUrl(dataUrl: string) {
  const match = DATA_URL_RE.exec(dataUrl);
  return match ? { type: match[1] as SettingsImageType, base64: match[2] } : null;
}

function decodedSize(base64: string) {
  return (base64.length * 3) / 4 - (base64.match(/=*$/)?.[0].length ?? 0);
}

/** A logo or signature as a `data:` URL; null removes it. */
const imageSchema = z
  .string()
  .superRefine((dataUrl, ctx) => {
    const image = parseImageDataUrl(dataUrl);
    if (!image || !image.base64.startsWith(BASE64_SIGNATURES[image.type])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a PNG or JPEG image" });
    } else if (decodedSize(image.base64) > SETTINGS_IMAGE_MAX_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        type: "string",
        maximum: SETTINGS_IMAGE_MAX_BYTES,
        inclusive: true,
        message: "Must be at most 1 MB",
      });
    }
  })
  .nullable();

/** What a staff member enters on the Settings page. The whole record is replaced on save. */
export const settingsInputSchema = z.object({
  name: z.string().trim().min(1),
  address: optionalText,
  phone: optionalText,
  email: optionalEmail,
  taxId: optionalText,
  logo: imageSchema,
  signature: imageSchema,
});

export type SettingsInputValues = z.input<typeof settingsInputSchema>;
export type SettingsInput = z.output<typeof settingsInputSchema>;

/** The company's identity used on documents (see GLOSSARY.md: Settings). Unset fields are null. */
export const settingsSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  taxId: z.string().nullable(),
  /** A `data:` URL. */
  logo: z.string().nullable(),
  /** A `data:` URL. */
  signature: z.string().nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;
