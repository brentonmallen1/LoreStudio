import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  type Location,
} from "react-router-dom";
import { setNavigator } from "./lib/navigation";
import {
  closeDelta,
  historyIndex,
  isOverlayPath,
  loadOrigin,
  originLabel,
  originPath,
  saveOrigin,
  type OverlayOrigin,
} from "./lib/overlay";
import PageOverlay from "./components/layout/PageOverlay";
import { useAuthStore } from "./stores/authStore";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import StoryWorkspacePage from "./pages/StoryWorkspace";
import SettingsPage from "./pages/Settings";
import SettingsAIPage from "./pages/SettingsAI";
import GuidePage from "./pages/GuidePage";
import CommandPalette from "./components/layout/CommandPalette";
import ScratchPadDrawer from "./components/common/ScratchPadDrawer";
import GlobalLayout from "./components/layout/GlobalLayout";
import PanelWindowPage from "./pages/PanelWindowPage";

/** Hands the router's navigate to non-React code (palette commands). */
function NavigatorBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator((to, opts) => navigate(to, opts));
    return () => setNavigator(null);
  }, [navigate]);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return null; // still loading
  return <>{children}</>;
}

/** Settings and Guides, framed as an overlay (lib/overlay.ts). */
function OverlayFrame({ origin, onClose }: { origin: OverlayOrigin | null; onClose: () => void }) {
  const { pathname } = useLocation();
  return (
    <RequireAuth>
      <PageOverlay
        title={pathname.startsWith("/guides") ? "Guides" : "Settings"}
        backTo={origin ? originLabel(origin.pathname) : "Dashboard"}
        onClose={onClose}
      >
        <Outlet />
      </PageOverlay>
    </RequireAuth>
  );
}

function overlayRoutes(frame: React.ReactNode) {
  return (
    <Route element={frame}>
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/ai-prompts" element={<SettingsAIPage />} />
      <Route path="/guides" element={<GuidePage />} />
      <Route path="/guides/:guideId" element={<GuidePage />} />
    </Route>
  );
}

interface Origin extends OverlayOrigin {
  location: Location;
}

function restoredOrigin(): Origin | null {
  const saved = loadOrigin();
  if (!saved) return null;
  const location: Location = { ...saved, state: null, key: "restored" };
  return { ...saved, location };
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const overlay = isOverlayPath(location.pathname);

  // The last ordinary page: what an overlay opens over. Tracked during render (the
  // "state from the previous render" pattern) because the page underneath has to be
  // chosen in the same render that opens the overlay — an effect would be one render
  // late, and that render would unmount the editor. After a reload inside the overlay
  // it comes back from sessionStorage.
  const [origin, setOrigin] = useState<Origin | null>(() => (overlay ? restoredOrigin() : null));
  if (!overlay && origin?.location !== location) {
    setOrigin({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      idx: historyIndex(),
      location,
    });
  }
  useEffect(() => saveOrigin(origin), [origin]);

  const background = overlay && origin ? origin.location : null;

  const close = useCallback(() => {
    const delta = closeDelta(origin, historyIndex());
    if (delta !== null) navigate(delta);
    else navigate(origin ? originPath(origin) : "/", { replace: true });
  }, [origin, navigate]);

  const frame = <OverlayFrame origin={origin} onClose={close} />;

  return (
    <>
      {/* `display: contents` keeps the wrapper out of layout; `inert` keeps focus, clicks
          and the editor's keys off the page while the overlay covers it. */}
      <div style={{ display: "contents" }} inert={!!background}>
        <Routes location={background ?? location}>
          <Route path="/login" element={<LoginPage />} />
          {/* The side panel in its own window: authenticated, but no app chrome (doc 11 P5). */}
          <Route
            path="/panel-window"
            element={
              <RequireAuth>
                <PanelWindowPage />
              </RequireAuth>
            }
          />
          <Route
            element={
              <RequireAuth>
                <GlobalLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/stories/:storyId/*" element={<StoryWorkspacePage />} />
            {/* Opened straight from a link, with nothing to cover: the frame over the app shell. */}
            {overlayRoutes(frame)}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {background && <Routes>{overlayRoutes(frame)}</Routes>}
    </>
  );
}

export default function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <BrowserRouter>
      <NavigatorBridge />
      <CommandPalette />
      <ScratchPadDrawer />
      <AppRoutes />
    </BrowserRouter>
  );
}
