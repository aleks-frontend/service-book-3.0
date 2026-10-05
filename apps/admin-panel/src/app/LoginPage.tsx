import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Wrench } from "lucide-react";
import { loginSchema, type LoginValues } from "@servicebook/schemas";
import { signIn, useSession } from "@/lib/authClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const AUTH_ERROR_MESSAGES = {
  invalid: "Invalid email or password",
  tooManyAttempts: "Too many login attempts. Wait a few seconds and try again.",
  unreachable: "Could not reach the server. Please try again.",
} as const;

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [authError, setAuthError] = useState<"invalid" | "tooManyAttempts" | "unreachable" | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // Navigate off the session hook rather than right after signIn.email()
  // resolves: the session store updates asynchronously, and RequireAuth would
  // otherwise bounce a too-early navigate straight back here.
  useEffect(() => {
    if (session) {
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  async function onSubmit(values: LoginValues) {
    setAuthError(null);
    const { error } = await signIn.email(values);
    if (error) {
      setAuthError(
        error.status === 401 ? "invalid" : error.status === 429 ? "tooManyAttempts" : "unreachable",
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col items-center gap-2 pb-2 text-center">
          <Wrench className="h-8 w-8 text-primary" aria-hidden />
          <h1 className="text-xl font-semibold">{t("Log in")}</h1>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            {t("Email")}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            className={errors.email && "border-destructive focus-visible:ring-destructive"}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{t("Enter a valid email address")}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            {t("Password")}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            className={errors.password && "border-destructive focus-visible:ring-destructive"}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{t("Enter your password")}</p>
          )}
        </div>

        {authError && (
          <p role="alert" className="text-sm text-destructive">
            {t(AUTH_ERROR_MESSAGES[authError])}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Log in")}
        </Button>
      </form>
      <LanguageSwitcher />
    </div>
  );
}
