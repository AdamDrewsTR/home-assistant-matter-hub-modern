import {
  Add,
  AutoFixHigh,
  Download,
  Map as MapIcon,
  PlayArrow,
  RestartAlt,
  Stop,
  Upload,
} from "@mui/icons-material";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { exportAllBridges } from "../../api/bridge-export.js";
import {
  restartAllBridges,
  startAllBridges,
  stopAllBridges,
} from "../../api/bridges.js";
import { BridgeImportDialog } from "../../components/bridge/BridgeImportDialog.js";
import { BridgeList } from "../../components/bridge/BridgeList";
import { BridgeWizard } from "../../components/bridge/BridgeWizard.js";
import { useNotifications } from "../../components/notifications/use-notifications.ts";
import { useBridges } from "../../hooks/data/bridges";
import { navigation } from "../../routes.tsx";
import { loadBridges } from "../../state/bridges/bridge-actions.ts";
import { useAppDispatch } from "../../state/hooks.ts";

export const BridgesPage = () => {
  const { t } = useTranslation();
  const notifications = useNotifications();

  const dispatch = useAppDispatch();
  const { content: bridges, isLoading, error: bridgeError } = useBridges();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    try {
      await exportAllBridges();
    } catch (e) {
      notifications.show({
        message: e instanceof Error ? e.message : t("bridge.exportFailed"),
        severity: "error",
      });
    }
  }, [notifications, t]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setImportFile(file);
        setImportDialogOpen(true);
      }
      e.target.value = "";
    },
    [],
  );

  const handleImportClose = useCallback(() => {
    setImportDialogOpen(false);
    setImportFile(null);
  }, []);

  const handleImported = useCallback(() => {
    dispatch(loadBridges());
  }, [dispatch]);

  const handleBulkAction = useCallback(
    async (action: "start" | "stop" | "restart") => {
      setBulkLoading(true);
      try {
        const labels = {
          start: t("bridge.actionStarted"),
          stop: t("bridge.actionStopped"),
          restart: t("bridge.actionRestarted"),
        };
        const fns = {
          start: startAllBridges,
          stop: stopAllBridges,
          restart: restartAllBridges,
        };
        const result = await fns[action]();
        notifications.show({
          message: t("bridge.actionResult", {
            label: labels[action],
            count: result.count,
          }),
          severity: "success",
        });
        dispatch(loadBridges());
      } catch (e) {
        notifications.show({
          message:
            e instanceof Error
              ? e.message
              : t("bridge.actionFailed", { action }),
          severity: "error",
        });
      } finally {
        setBulkLoading(false);
      }
    },
    [notifications, dispatch, t],
  );

  useEffect(() => {
    if (bridgeError) {
      notifications.show({
        message: bridgeError.message ?? t("bridge.couldNotLoad"),
        severity: "error",
      });
    }
  }, [bridgeError, notifications, t]);

  return (
    <>
      <Backdrop
        sx={(theme) => ({ zIndex: theme.zIndex.drawer + 1 })}
        open={isLoading || bulkLoading}
      >
        {(isLoading || bulkLoading) && <CircularProgress color="inherit" />}
      </Backdrop>

      <Stack spacing={4}>
        {bridges && (
          <>
            <Card variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  component={Link}
                  to={navigation.setup}
                  startIcon={<Add />}
                  variant="contained"
                >
                  {t("modern.addHub")}
                </Button>
                <Button
                  onClick={handleImportClick}
                  startIcon={<Download />}
                  variant="outlined"
                >
                  {t("common.import")}
                </Button>
                <Button
                  onClick={handleExport}
                  startIcon={<Upload />}
                  variant="outlined"
                  disabled={!bridges.length}
                >
                  {t("common.exportAll")}
                </Button>
              </Stack>
              <Box
                component="details"
                sx={{
                  mt: 2.5,
                  pt: 2,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box
                  component="summary"
                  sx={{ cursor: "pointer", color: "text.secondary" }}
                >
                  {t("workspace.batchTools")}
                </Box>
                <Box
                  display="flex"
                  justifyContent="end"
                  flexWrap="wrap"
                  gap={1}
                  paddingTop={{ xs: 1, sm: 0 }}
                >
                  {bridges.length >= 1 && (
                    <>
                      <Button
                        onClick={() => handleBulkAction("start")}
                        startIcon={<PlayArrow />}
                        variant="outlined"
                        size="small"
                        color="success"
                        disabled={bulkLoading}
                      >
                        {t("common.startAll")}
                      </Button>
                      <Button
                        onClick={() => handleBulkAction("stop")}
                        startIcon={<Stop />}
                        variant="outlined"
                        size="small"
                        color="error"
                        disabled={bulkLoading}
                      >
                        {t("common.stopAll")}
                      </Button>
                      <Button
                        onClick={() => handleBulkAction("restart")}
                        startIcon={<RestartAlt />}
                        variant="outlined"
                        size="small"
                        color="warning"
                        disabled={bulkLoading}
                      >
                        {t("common.restartAll")}
                      </Button>
                    </>
                  )}
                  <Button
                    component={Link}
                    to={navigation.areaSetup}
                    startIcon={<MapIcon />}
                    variant="outlined"
                  >
                    {t("workspace.tools.areas")}
                  </Button>
                  <Button
                    onClick={() => setWizardOpen(true)}
                    startIcon={<AutoFixHigh />}
                    variant="outlined"
                  >
                    {t("workspace.multiHubWizard")}
                  </Button>
                  <Button
                    component={Link}
                    to={navigation.advancedSetup}
                    endIcon={<Add />}
                    variant="outlined"
                  >
                    {t("modern.advancedSetup")}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    style={{ display: "none" }}
                  />
                </Box>
              </Box>
            </Card>

            <BridgeList bridges={bridges} />
          </>
        )}
      </Stack>

      <BridgeImportDialog
        open={importDialogOpen}
        file={importFile}
        onClose={handleImportClose}
        onImported={handleImported}
      />

      <BridgeWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={() => dispatch(loadBridges())}
      />
    </>
  );
};
