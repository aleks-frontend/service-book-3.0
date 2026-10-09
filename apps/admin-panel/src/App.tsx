import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout, NAV_ITEMS } from "./components/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./app/LoginPage";
import { ActionsPage } from "./app/ActionsPage";
import { CustomersPage } from "./app/CustomersPage";
import { DevicesPage } from "./app/DevicesPage";
import { PlaceholderPage } from "./app/PlaceholderPage";
import { ServicesPage } from "./app/ServicesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/** Sections built so far; the rest show a placeholder until their ticket lands. */
const PAGES: Partial<Record<(typeof NAV_ITEMS)[number]["to"], ReactNode>> = {
  "/services": <ServicesPage />,
  "/customers": <CustomersPage />,
  "/devices": <DevicesPage />,
  "/actions": <ActionsPage />,
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/services" replace />} />
              {NAV_ITEMS.map(({ to, labelKey }) => (
                <Route
                  key={to}
                  path={to}
                  element={PAGES[to] ?? <PlaceholderPage titleKey={labelKey} />}
                />
              ))}
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
