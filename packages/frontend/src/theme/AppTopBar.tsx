import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Terminal from "@mui/icons-material/Terminal";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { LogViewer } from "../components/logs/LogViewer.tsx";
import { StatusIndicator } from "../components/status/StatusIndicator.tsx";
import { navigation } from "../routes.tsx";
import { AppLogo } from "./AppLogo.tsx";

export const AppTopBar = () => {
  const { t } = useTranslation();
  const { mode, systemMode, setMode } = useColorScheme();
  const dark = (mode === "system" ? systemMode : mode) === "dark";
  const [logsOpen, setLogsOpen] = useState(false);

  return (
    <>
      <AppBar>
        <Toolbar sx={{ minHeight: "76px !important", px: { xs: 1.5, sm: 3 } }}>
          <Container
            maxWidth="xl"
            disableGutters
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 0.5, sm: 2 },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0, "& svg": { maxWidth: 40 } }}>
              <AppLogo large={false} />
            </Box>
            <StatusIndicator />
            <Tooltip title={t(dark ? "nav.lightMode" : "nav.darkMode")}>
              <IconButton
                aria-label={t(dark ? "nav.lightMode" : "nav.darkMode")}
                onClick={() => setMode(dark ? "light" : "dark")}
              >
                {dark ? <LightModeOutlined /> : <DarkModeOutlined />}
              </IconButton>
            </Tooltip>
            <Button
              component={Link}
              to={navigation.bridges}
              startIcon={<SettingsOutlined />}
              aria-label={t("workspace.toolsTitle")}
              size="small"
              sx={{
                minWidth: { xs: 40, sm: 64 },
                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                {t("workspace.toolsTitle")}
              </Box>
            </Button>
            <Tooltip title={t("nav.systemLogs")}>
              <IconButton
                aria-label={t("nav.systemLogs")}
                onClick={() => setLogsOpen(true)}
              >
                <Terminal />
              </IconButton>
            </Tooltip>
          </Container>
        </Toolbar>
      </AppBar>
      <LogViewer open={logsOpen} onClose={() => setLogsOpen(false)} />
    </>
  );
};
