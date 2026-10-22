import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LogOut, Menu } from "lucide-react";
import { CompanyLogo } from "./CompanyLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { ServiceReportOfferProvider } from "./ServiceReportOfferProvider";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/authClient";
import { useMeQuery } from "@/lib/useMeQuery";

export const NAV_ITEMS = [
  { to: "/services", labelKey: "Services" },
  { to: "/customers", labelKey: "Customers" },
  { to: "/devices", labelKey: "Devices" },
  { to: "/actions", labelKey: "Actions" },
  { to: "/statistics", labelKey: "Statistics" },
  { to: "/settings", labelKey: "Settings" },
] as const;

export function AppLayout() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: me } = useMeQuery();

  async function handleLogOut() {
    const { error } = await signOut();
    if (error) {
      toast.error(t("Could not reach the server. Please try again."));
      return;
    }
    // Navigate via a full load so no cached data or session state survives.
    queryClient.clear();
    window.location.assign("/login");
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      // The current page is marked on the bar's yellow edge, like a floor marking.
      "-mb-1 flex items-center border-b-4 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      isActive
        ? "border-foreground font-bold text-foreground"
        : "border-transparent font-medium text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="min-h-screen">
      {/* The bar is ink in both themes, so what sits on it takes the dark tokens. */}
      <header className="dark border-b-4 border-primary bg-bar text-foreground">
        <div className="container flex h-14 items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <CompanyLogo />
          </div>

          <nav
            aria-label={t("Main navigation")}
            className="hidden flex-1 items-stretch gap-1 self-stretch lg:flex"
          >
            {NAV_ITEMS.map(({ to, labelKey }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                {t(labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher className="hidden sm:flex" />
            <ThemeToggle className="hidden sm:inline-grid" />
            {me && (
              <span className="hidden text-sm text-muted-foreground md:inline">{me.name}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogOut}
              className="hidden sm:inline-flex"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              {t("Log out")}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label={t("Menu")}>
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {NAV_ITEMS.map(({ to, labelKey }) => (
                  <DropdownMenuItem key={to} asChild>
                    <NavLink to={to}>{t(labelKey)}</NavLink>
                  </DropdownMenuItem>
                ))}
                <div className="flex gap-1 px-2 py-2 sm:hidden">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
                <DropdownMenuItem onSelect={handleLogOut} className="cursor-pointer sm:hidden">
                  {t("Log out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <ServiceReportOfferProvider>
          <Outlet />
        </ServiceReportOfferProvider>
      </main>
    </div>
  );
}
