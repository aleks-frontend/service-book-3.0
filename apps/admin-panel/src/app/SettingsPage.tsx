import { useEffect } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  SETTINGS_IMAGE_TYPES,
  settingsInputSchema,
  type Settings,
  type SettingsInput,
  type SettingsInputValues,
} from "@servicebook/schemas";
import { useSaveSettingsMutation, useSettingsQuery } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/ImageUploadField";

const FIELDS = [
  {
    name: "name",
    label: "Company name",
    required: true,
    error: "Enter the company name",
    autoComplete: "organization",
  },
  { name: "address", label: "Address", autoComplete: "street-address" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  {
    name: "email",
    label: "Email",
    error: "Enter a valid email address",
    type: "email",
    autoComplete: "email",
  },
  { name: "taxId", label: "Tax ID" },
] as const satisfies readonly {
  name: keyof SettingsInputValues;
  label: string;
  required?: boolean;
  error?: string;
  type?: string;
  autoComplete?: string;
}[];

const IMAGES = [
  { name: "logo", label: "Logo" },
  { name: "signature", label: "Signature" },
] as const satisfies readonly { name: keyof SettingsInputValues; label: string }[];

function toFormValues(settings: Settings): SettingsInputValues {
  return {
    name: settings.name ?? "",
    address: settings.address ?? "",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    taxId: settings.taxId ?? "",
    logo: settings.logo,
    signature: settings.signature,
  };
}

/** The company identity printed on documents (see GLOSSARY.md: Settings). */
export function SettingsPage() {
  const { t } = useTranslation();
  const { data: settings, isPending, isError } = useSettingsQuery();
  const saveSettings = useSaveSettingsMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsInputValues, unknown, SettingsInput>({
    // zodResolver submits the schema's parsed output (blank optional fields
    // as null), but @hookform/resolvers v3 only types it as the input.
    resolver: zodResolver(settingsInputSchema) as Resolver<
      SettingsInputValues,
      unknown,
      SettingsInput
    >,
  });

  useEffect(() => {
    if (settings) reset(toFormValues(settings));
  }, [settings, reset]);

  return (
    <section className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("The company details printed on intake receipts and service reports.")}
        </p>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load the settings.")}</p>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">{t("Loading…")}</p>
      ) : (
        <form
          onSubmit={handleSubmit((input) => saveSettings.mutate(input))}
          noValidate
          autoComplete="off"
          className="space-y-6 rounded-lg border bg-card p-6"
        >
          <p className="text-sm text-muted-foreground">{t("Fields marked with * are required.")}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => {
              const error = errors[field.name];
              const id = `settings-${field.name}`;
              return (
                <div
                  key={field.name}
                  className={cn("space-y-1.5", field.name === "address" && "sm:col-span-2")}
                >
                  <label htmlFor={id} className="text-sm font-medium">
                    {t(field.label)}
                    {"required" in field && " *"}
                  </label>
                  <Input
                    id={id}
                    type={"type" in field ? field.type : "text"}
                    autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
                    aria-invalid={!!error}
                    className={cn(error && "border-destructive focus-visible:ring-destructive")}
                    {...register(field.name)}
                  />
                  {error && "error" in field && (
                    <p className="text-sm text-destructive">{t(field.error)}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {IMAGES.map((image) => (
              <Controller
                key={image.name}
                control={control}
                name={image.name}
                render={({ field, fieldState }) => (
                  <ImageUploadField
                    id={`settings-${image.name}`}
                    label={t(image.label)}
                    value={field.value ?? null}
                    accept={SETTINGS_IMAGE_TYPES.join(",")}
                    hint={t("PNG or JPEG, up to 1 MB.")}
                    onChange={field.onChange}
                    // The schema's messages double as translation keys.
                    error={fieldState.error?.message && t(fieldState.error.message)}
                  />
                )}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveSettings.isPending}>
              {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("Save changes")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
