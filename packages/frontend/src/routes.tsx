import {
  Navigate,
  type RouteObject,
  useParams,
  useSearchParams,
} from "react-router";
import { AppPage } from "./pages/AppPage.tsx";
import { CreateHubPage } from "./pages/home/CreateHubPage.tsx";
import { HomePage } from "./pages/home/HomePage.tsx";
import { SystemWorkspace } from "./pages/home/SystemWorkspace.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";

const documentationUrl = "https://riddix.github.io/home-assistant-matter-hub";
export const navigation = {
  dashboard: "/",
  advancedDashboard: "/system/health",
  setup: "/setup",
  advancedSetup: "/setup?advanced=true",
  bridges: "/system/hubs",
  bridge: (bridgeId: string) =>
    `/?hub=${encodeURIComponent(bridgeId)}&view=advanced&section=diagnostics`,
  hub: (bridgeId: string, view = "devices", section?: string) =>
    `/?${new URLSearchParams({ hub: bridgeId, view, ...(section && { section }) })}`,
  createBridge: "/setup",
  areaSetup: "/system/areas",
  editBridge: (bridgeId: string) =>
    `/?hub=${encodeURIComponent(bridgeId)}&view=advanced&section=configuration`,
  devices: "/system/endpoints",
  standaloneDevices: "/system/standalone",
  networkMap: "/system/network",
  health: "/system/health",
  labels: "/system/filters",
  lockCredentials: "/system/credentials",
  plugins: "/system/plugins",
  settings: "/system/backup",
  startup: "/system/startup",

  githubRepository:
    "https://github.com/AdamDrewsTR/home-assistant-matter-hub-modern/",
  documentation: documentationUrl,
  support: `${documentationUrl}/support`,
  faq: {
    multiFabric: `${documentationUrl}/connect-multiple-fabrics`,
    bridgeConfig: `${documentationUrl}/bridge-configuration`,
  },
};

function LegacyHubRedirect({ edit = false }: { edit?: boolean }) {
  const { bridgeId } = useParams();
  return (
    <Navigate
      replace
      to={
        bridgeId
          ? navigation.hub(
              bridgeId,
              "advanced",
              edit ? "configuration" : "diagnostics",
            )
          : "/"
      }
    />
  );
}

function LegacyToolRedirect({ to }: { to: string }) {
  const [params] = useSearchParams();
  return <Navigate replace to={`${to}${params.size ? `?${params}` : ""}`} />;
}

export const routes: RouteObject[] = [
  {
    path: "",
    element: <AppPage />,
    children: [
      {
        path: "",
        element: <HomePage />,
      },
      { path: navigation.setup, element: <CreateHubPage /> },
      { path: "/system/:tool", element: <SystemWorkspace /> },
      {
        path: "/bridges/create",
        element: <Navigate replace to={navigation.advancedSetup} />,
      },
      {
        path: "/bridges/area-setup",
        element: <Navigate replace to={navigation.areaSetup} />,
      },
      { path: "/bridges/:bridgeId", element: <LegacyHubRedirect /> },
      { path: "/bridges/:bridgeId/edit", element: <LegacyHubRedirect edit /> },
      ...Object.entries({
        "/advanced": navigation.advancedDashboard,
        "/bridges": navigation.bridges,
        "/devices": navigation.devices,
        "/standalone-devices": navigation.standaloneDevices,
        "/network-map": navigation.networkMap,
        "/health": navigation.health,
        "/labels": navigation.labels,
        "/lock-credentials": navigation.lockCredentials,
        "/plugins": navigation.plugins,
        "/settings": navigation.settings,
        "/startup": navigation.startup,
      }).map(([path, to]) => ({
        path,
        element: <LegacyToolRedirect to={to} />,
      })),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
