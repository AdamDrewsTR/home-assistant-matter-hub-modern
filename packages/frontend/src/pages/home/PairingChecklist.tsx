import type { BridgeDataWithMetadata } from "@home-assistant-matter-hub/common";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ControllerWarnings } from "../../components/bridge/BridgeDetails.tsx";
import { PreflightPanel } from "../../components/bridge/PreflightPanel.tsx";
import { navigation } from "../../routes.tsx";

export function PairingChecklist({
  bridge,
}: {
  bridge: BridgeDataWithMetadata;
}) {
  const { t } = useTranslation();
  const [controller, setController] = useState("alexa");
  return (
    <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h2">{t("deviceWorkspace.pair.title")}</Typography>
        <TextField
          select
          label={t("deviceWorkspace.pair.controller")}
          value={controller}
          onChange={(event) => setController(event.target.value)}
        >
          {["alexa", "apple", "google", "smartthings", "aqara"].map((item) => (
            <MenuItem key={item} value={item}>
              {t(`deviceWorkspace.controllers.${item}`)}
            </MenuItem>
          ))}
        </TextField>
        <Box>
          <Typography fontWeight={600}>
            {t("deviceWorkspace.pair.step1")}
          </Typography>
          <Alert
            severity={bridge.status === "running" ? "info" : "warning"}
            sx={{ mt: 1 }}
          >
            {t("deviceWorkspace.pair.hubState", {
              state: bridge.status,
              count: bridge.deviceCount,
            })}{" "}
            {bridge.statusReason}
          </Alert>
          <Button
            component={Link}
            to={navigation.hub(bridge.id, "advanced", "diagnostics")}
          >
            {t("deviceWorkspace.pair.diagnostics")}
          </Button>
        </Box>
        <Box>
          <Typography fontWeight={600}>
            {t("deviceWorkspace.pair.step2")}
          </Typography>
          <Typography color="text.secondary">
            {t("deviceWorkspace.pair.network")}
          </Typography>
          <PreflightPanel port={bridge.port} alexa={controller === "alexa"} />
        </Box>
        <Box>
          <Typography fontWeight={600}>
            {t("deviceWorkspace.pair.step3")}
          </Typography>
          <Typography color="text.secondary">
            {t("deviceWorkspace.pair.scan")}
          </Typography>
          {bridge.commissioning?.isCommissioned && (
            <Alert severity="info" sx={{ mt: 1 }}>
              {t("deviceWorkspace.pair.multiAdmin")}
            </Alert>
          )}
        </Box>
        <Box>
          <Typography fontWeight={600}>
            {t("deviceWorkspace.pair.step4")}
          </Typography>
          <Typography color="text.secondary">
            {t("deviceWorkspace.pair.verify")}
          </Typography>
          <ControllerWarnings bridge={bridge} />
          <Button component={Link} to={navigation.hub(bridge.id, "health")}>
            {t("deviceWorkspace.health.title")}
          </Button>
        </Box>
        <Alert severity="warning">{t("deviceWorkspace.pair.noReset")}</Alert>
      </Stack>
    </Card>
  );
}
