import ArrowBack from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { AreaBridgeSetupPage } from "../area-setup/AreaBridgeSetupPage.tsx";
import { BridgesPage } from "../bridges/BridgesPage.tsx";
import { DevicesPage } from "../devices/DevicesPage.tsx";
import { HealthPage } from "../health/HealthPage.tsx";
import { LabelsPage } from "../labels/LabelsPage.tsx";
import { LockCredentialsPage } from "../lock-credentials/LockCredentialsPage.tsx";
import { NetworkMapPage } from "../network-map/NetworkMapPage.tsx";
import { PluginsPage } from "../plugins/PluginsPage.tsx";
import { SettingsPage } from "../settings/SettingsPage.tsx";
import { StandaloneDevicesPage } from "../standalone-devices/StandaloneDevicesPage.tsx";
import { StartupPage } from "../startup/StartupPage.tsx";

export const systemGroups = {
  devices: ["hubs", "endpoints", "standalone", "areas", "startup"],
  integrations: ["network", "credentials", "filters", "plugins"],
  system: [
    "health",
    "events",
    "network-check",
    "system-info",
    "backup",
    "updates",
    "recovery",
    "access",
    "translations",
  ],
};
const allTools = Object.values(systemGroups).flat();

export function SystemWorkspace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tool: requested } = useParams();
  const tool = allTools.includes(requested ?? "") ? requested! : "hubs";
  const panels: Record<string, React.ReactNode> = {
    hubs: <BridgesPage />,
    endpoints: <DevicesPage embedded />,
    standalone: <StandaloneDevicesPage embedded />,
    areas: <AreaBridgeSetupPage embedded />,
    startup: <StartupPage embedded />,
    network: <NetworkMapPage embedded />,
    credentials: <LockCredentialsPage embedded />,
    filters: <LabelsPage embedded />,
    plugins: <PluginsPage embedded />,
    health: <HealthPage section="overview" />,
    events: <HealthPage section="events" />,
    "network-check": <HealthPage section="network" />,
    "system-info": <HealthPage section="system" />,
    translations: <HealthPage section="translations" />,
    backup: <SettingsPage section="backup" />,
    updates: <SettingsPage section="updates" />,
    recovery: <SettingsPage section="recovery" />,
    access: <SettingsPage section="access" />,
  };
  return (
    <Stack spacing={4}>
      <Box>
        <Button
          component={Link}
          to="/"
          startIcon={<ArrowBack />}
          sx={{ mb: 2 }}
        >
          {t("modern.backHome")}
        </Button>
        <Typography variant="overline" color="primary" display="block">
          {t("workspace.systemEyebrow")}
        </Typography>
        <Typography variant="h1" sx={{ mt: 1 }}>
          {t("workspace.toolsTitle")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          {t("workspace.toolsDescription")}
        </Typography>
      </Box>
      <TextField
        select
        label={t("workspace.section")}
        value={tool}
        onChange={(event) => navigate(`/system/${event.target.value}`)}
        sx={{ display: { md: "none" } }}
      >
        {allTools.map((key) => (
          <MenuItem key={key} value={key}>
            {t(`workspace.tools.${key}`)}
          </MenuItem>
        ))}
      </TextField>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "230px minmax(0, 1fr)",
          },
          gap: 4,
        }}
      >
        <Box
          component="nav"
          aria-label={t("workspace.systemNav")}
          sx={{ display: { xs: "none", md: "block" } }}
        >
          <Card variant="outlined" sx={{ p: 2, position: "sticky", top: 100 }}>
            {Object.entries(systemGroups).map(([group, keys]) => (
              <Stack key={group} spacing={0.5} sx={{ mb: 2 }}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ px: 1 }}
                >
                  {t(`workspace.groups.${group}`)}
                </Typography>
                {keys.map((key) => (
                  <Button
                    key={key}
                    component={Link}
                    to={`/system/${key}`}
                    aria-current={tool === key ? "page" : undefined}
                    variant={tool === key ? "contained" : "text"}
                    sx={{ justifyContent: "flex-start", textAlign: "left" }}
                  >
                    {t(`workspace.tools.${key}`)}
                  </Button>
                ))}
              </Stack>
            ))}
          </Card>
        </Box>
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Box>
            <Typography variant="h2">{t(`workspace.tools.${tool}`)}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {t(`workspace.toolDescriptions.${tool}`)}
            </Typography>
          </Box>
          <Box key={tool} sx={{ minWidth: 0 }}>
            {panels[tool]}
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
