import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import StoryWorkspacePage from "./pages/StoryWorkspace";
import SettingsPage from "./pages/Settings";
import SettingsAIPage from "./pages/SettingsAI";
import CommandPalette from "./components/layout/CommandPalette";
import ScratchPadDrawer from "./components/common/ScratchPadDrawer";
import GlobalLayout from "./components/layout/GlobalLayout";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return null; // still loading
  return <>{children}</>;
}

export default function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <BrowserRouter>
      <CommandPalette />
      <ScratchPadDrawer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <GlobalLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/stories/:storyId/*" element={<StoryWorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/ai-prompts" element={<SettingsAIPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
