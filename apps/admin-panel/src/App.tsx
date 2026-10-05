import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout, NAV_ITEMS } from "./components/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { LoginPage } from "./app/LoginPage";
import { PlaceholderPage } from "./app/PlaceholderPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

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
                <Route key={to} path={to} element={<PlaceholderPage titleKey={labelKey} />} />
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
