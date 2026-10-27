import type { BridgeDataWithMetadata } from "@home-assistant-matter-hub/common";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DevicesIcon from "@mui/icons-material/Devices";
import EditIcon from "@mui/icons-material/Edit";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import FilterListIcon from "@mui/icons-material/FilterList";
import InfoIcon from "@mui/icons-material/Info";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import RemoveIcon from "@mui/icons-material/Remove";
import SyncIcon from "@mui/icons-material/Sync";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import WifiIcon from "@mui/icons-material/Wifi";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { forceSyncBridge, openCommissioningWindow } from "../../api/bridges.ts";
import { navigation } from "../../routes.tsx";
import { timeAgo } from "../../time.ts";
import { FabricList } from "../fabric/FabricList.tsx";
import { useNotifications } from "../notifications/use-notifications.ts";

export interface BridgeDetailsProps {
  readonly bridge: BridgeDataWithMetadata;
}

function PairingCodeCopy({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Stack alignItems="flex-end" sx={{ minWidth: 0 }}>
      <Button
        size="small"
        aria-label={`${t("common.copy")} ${label}`}
        disabled={copying}
        endIcon={
          copied ? (
            <CheckIcon fontSize="small" />
          ) : (
            <ContentCopyIcon fontSize="small" />
          )
        }
        sx={{
          fontFamily: "monospace",
          overflowWrap: "anywhere",
          userSelect: "text",
        }}
        onClick={async () => {
          setCopying(true);
          setCopied(false);
          setError(false);
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setError(true);
          } finally {
            setCopying(false);
          }
        }}
      >
        {value}
      </Button>
      <Typography role="status" variant="caption" color="success.main">
        {copied ? t("common.copied") : ""}
      </Typography>
      {error && <Alert severity="error">{t("common.copyFailed")}</Alert>}
    </Stack>
  );
}

export const BridgeDetails = ({ bridge }: BridgeDetailsProps) => {
  return (
    <Grid container spacing={2}>
      {bridge.featureFlags?.serverMode &&
        bridge.featureFlags?.vacuumOnOff === false && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="warning" icon={<WarningAmberIcon />}>
              <AlertTitle>
                Vacuum OnOff Disabled (Alexa incompatible)
              </AlertTitle>
              Alexa <strong>requires</strong> the OnOff cluster
              (PowerController) for robotic vacuums. With OnOff disabled, the
              vacuum commissions but never appears in the Alexa app. Only
              disable this if you exclusively use <strong>Apple Home</strong>.
            </Alert>
          </Grid>
        )}
      {!bridge.featureFlags?.serverMode && bridge.featureFlags?.vacuumOnOff && (
        <Grid size={{ xs: 12 }}>
          <Alert severity="info" icon={<WarningAmberIcon />}>
            <AlertTitle>Vacuum OnOff Cluster Enabled (Alexa)</AlertTitle>
            OnOff cluster is active for Alexa PowerController compatibility.
            This may cause issues with <strong>Apple Home</strong> and{" "}
            <strong>Google Home</strong>.
          </Alert>
        </Grid>
      )}
      <Grid size={{ xs: 12, md: 4 }}>
        <PairingCard bridge={bridge} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <InfoCard bridge={bridge} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <FabricsCard bridge={bridge} />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <FiltersCard bridge={bridge} />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <ControllerWarnings bridge={bridge} />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <FailedEntities bridge={bridge} />
      </Grid>
    </Grid>
  );
};

export const PairingCard = ({ bridge }: { bridge: BridgeDataWithMetadata }) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const notification = useNotifications();

  const handleOpenCommissioningWindow = async () => {
    setOpening(true);
    try {
      await openCommissioningWindow(bridge.id);
      setDialogOpen(true);
    } catch (e) {
      notification.show({
        message: `Failed to open commissioning window: ${e instanceof Error ? e.message : String(e)}`,
        severity: "error",
      });
    } finally {
      setOpening(false);
    }
  };

  if (!bridge.commissioning) {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Avatar sx={{ bgcolor: "grey.500" }}>
              <QrCode2Icon />
            </Avatar>
            <Typography variant="h6">{t("bridge.pairing")}</Typography>
          </Box>
          <Typography color="text.secondary">
            {t("bridge.bridgeNotRunning")}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ height: "100%" }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Avatar sx={{ bgcolor: "primary.main" }}>
              <QrCode2Icon />
            </Avatar>
            <Typography variant="h6">{t("bridge.pairing")}</Typography>
          </Box>

          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
          >
            <Box position="relative">
              {bridge.commissioning.isCommissioned && (
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  sx={{
                    transform: "translate(-50%, -50%) rotate(-45deg)",
                    zIndex: 1,
                  }}
                >
                  <Chip
                    label={t("bridge.commissioned")}
                    color="success"
                    size="small"
                  />
                </Box>
              )}
              <Box
                sx={{
                  background: "white",
                  padding: 1,
                  borderRadius: 1,
                  opacity: bridge.commissioning.isCommissioned ? 0.5 : 1,
                }}
              >
                <QRCodeSVG
                  value={bridge.commissioning.qrPairingCode}
                  size={120}
                  aria-label={t("bridge.pairingQrCode")}
                />
              </Box>
            </Box>

            <Stack spacing={1} width="100%">
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="body2" color="text.secondary">
                  {t("bridge.manualCode")}:
                </Typography>
                <PairingCodeCopy
                  value={bridge.commissioning.manualPairingCode}
                  label={t("bridge.manualCode")}
                />
              </Box>
            </Stack>

            {bridge.commissioning.isCommissioned && (
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  opening ? <CircularProgress size={16} /> : <QrCode2Icon />
                }
                onClick={handleOpenCommissioningWindow}
                disabled={opening}
                fullWidth
              >
                {opening
                  ? t("bridge.openingWindow")
                  : t("bridge.addController")}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <PairingDialog
        bridge={bridge}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
};

export const InfoCard = ({ bridge }: { bridge: BridgeDataWithMetadata }) => {
  const { t } = useTranslation();
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Avatar sx={{ bgcolor: "info.main" }}>
            <InfoIcon />
          </Avatar>
          <Typography variant="h6">{t("bridge.bridgeInfo")}</Typography>
        </Box>

        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t("bridge.bridgeId")}
            </Typography>
            <Typography variant="body2" fontFamily="monospace" noWrap>
              {bridge.id}
            </Typography>
          </Box>
          <Divider />
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {t("common.port")}
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {bridge.port}
            </Typography>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {t("common.devices")}
            </Typography>
            <Chip
              icon={<DevicesIcon />}
              label={bridge.deviceCount}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          {bridge.commissioning && (
            <>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {t("bridge.passcode")}
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {bridge.commissioning.passcode}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  {t("bridge.discriminator")}
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {bridge.commissioning.discriminator}
                </Typography>
              </Box>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export const FabricsCard = ({ bridge }: { bridge: BridgeDataWithMetadata }) => {
  const { t } = useTranslation();
  const fabrics = bridge.commissioning?.fabrics ?? [];
  const [syncing, setSyncing] = useState(false);
  const notification = useNotifications();

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const result = await forceSyncBridge(bridge.id);
      notification.show({
        message: `Synced ${result.syncedCount} devices to controllers`,
        severity: "success",
      });
    } catch (e) {
      notification.show({
        message: `Force sync failed: ${e instanceof Error ? e.message : String(e)}`,
        severity: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Avatar
            sx={{ bgcolor: fabrics.length > 0 ? "success.main" : "grey.500" }}
          >
            <WifiIcon />
          </Avatar>
          <Typography variant="h6">
            {t("bridge.connectedFabrics", { count: fabrics.length })}
          </Typography>
          <Tooltip title="A fabric represents a connection to a Matter controller (e.g., Apple Home, Google Home, Alexa). Each controller creates one fabric when paired.">
            <InfoOutlinedIcon
              fontSize="small"
              color="action"
              sx={{ cursor: "help" }}
            />
          </Tooltip>
        </Box>

        {fabrics.length === 0 ? (
          <Typography color="text.secondary">
            {t("bridge.noFabrics")}
          </Typography>
        ) : (
          <Stack spacing={2}>
            <FabricList fabrics={fabrics} />
            <Tooltip title="Push all current device states to connected controllers">
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  syncing ? <CircularProgress size={16} /> : <SyncIcon />
                }
                onClick={handleForceSync}
                disabled={syncing}
                fullWidth
              >
                {syncing ? t("bridge.syncing") : t("bridge.forceSync")}
              </Button>
            </Tooltip>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

const FiltersCard = ({ bridge }: { bridge: BridgeDataWithMetadata }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasFilters =
    bridge.filter.include.length > 0 || bridge.filter.exclude.length > 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Avatar sx={{ bgcolor: "warning.main" }}>
            <FilterListIcon />
          </Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t("bridge.entityFilters")}
          </Typography>
          <Tooltip
            title={
              hasFilters ? t("bridge.editFilters") : t("bridge.addFilters")
            }
          >
            <IconButton
              size="small"
              onClick={() => navigate(navigation.editBridge(bridge.id))}
            >
              {hasFilters ? <EditIcon /> : <AddIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {hasFilters ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {bridge.filter.include.map((filter) => (
              <Chip
                key={`include-${filter.type}-${filter.value}`}
                size="small"
                icon={<AddIcon />}
                label={
                  <span>
                    <strong>{filter.type}</strong>: {filter.value}
                  </span>
                }
                color="success"
                variant="outlined"
              />
            ))}
            {bridge.filter.exclude.map((filter) => (
              <Chip
                key={`exclude-${filter.type}-${filter.value}`}
                size="small"
                icon={<RemoveIcon />}
                label={
                  <span>
                    <strong>{filter.type}</strong>: {filter.value}
                  </span>
                }
                color="error"
                variant="outlined"
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t("bridge.noFilters")}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const PairingDialog = ({
  bridge,
  open,
  onClose,
}: {
  bridge: BridgeDataWithMetadata;
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  if (!bridge.commissioning) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <QrCode2Icon />
          {t("bridge.addController")}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {t("bridge.scanQrCode")}
        </Typography>

        <Box display="flex" justifyContent="center" my={3}>
          <Box
            sx={{
              background: "white",
              padding: 2,
              borderRadius: 1,
            }}
          >
            <QRCodeSVG
              value={bridge.commissioning.qrPairingCode}
              size={200}
              aria-label={t("bridge.pairingQrCode")}
            />
          </Box>
        </Box>

        <Stack spacing={1}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2">
              <strong>{t("bridge.manualCode")}:</strong>
            </Typography>
            <PairingCodeCopy
              value={bridge.commissioning.manualPairingCode}
              label={t("bridge.manualCode")}
            />
          </Box>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2">
              <strong>{t("bridge.passcode")}:</strong>
            </Typography>
            <PairingCodeCopy
              value={bridge.commissioning.passcode.toString()}
              label={t("bridge.passcode")}
            />
          </Box>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2">
              <strong>{t("bridge.discriminator")}:</strong>
            </Typography>
            <PairingCodeCopy
              value={bridge.commissioning.discriminator.toString()}
              label={t("bridge.discriminator")}
            />
          </Box>
        </Stack>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Matter supports connecting the same bridge to multiple controllers
            simultaneously. Each controller will have independent control.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.close")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export const ControllerWarnings = ({
  bridge,
}: {
  bridge: BridgeDataWithMetadata;
}) => {
  const warnings = bridge.controllerWarnings;
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Alert severity="warning" icon={<ErrorOutlineIcon />}>
          <AlertTitle>Controller warnings ({warnings.length})</AlertTitle>
          <Typography variant="body2" component="div">
            A commissioned controller may not show these devices:
          </Typography>
          <Box sx={{ mt: 1, maxHeight: 200, overflow: "auto" }}>
            {warnings.map((w) => (
              <Box
                key={`${w.entityId}:${w.deviceTypeId}:${w.controller}`}
                sx={{ mb: 0.5 }}
              >
                <Typography variant="body2" component="span" fontWeight="bold">
                  {w.entityId}
                </Typography>
                <Typography
                  variant="body2"
                  component="span"
                  color="text.secondary"
                >
                  {" on "}
                  {w.controllerLabel}
                  {w.note ? ` (${w.note})` : ""}
                </Typography>
              </Box>
            ))}
          </Box>
        </Alert>
      </CardContent>
    </Card>
  );
};

export const FailedEntities = ({
  bridge,
}: {
  bridge: BridgeDataWithMetadata;
}) => {
  const failedEntities = bridge.failedEntities;
  if (!failedEntities || failedEntities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Alert severity="warning" icon={<ErrorOutlineIcon />}>
          <AlertTitle>Failed Entities ({failedEntities.length})</AlertTitle>
          <Typography variant="body2" component="div">
            The following entities could not be added to the bridge:
          </Typography>
          <Box sx={{ mt: 1, maxHeight: 200, overflow: "auto" }}>
            {failedEntities.map((entity) => (
              <Box key={entity.entityId} sx={{ mb: 0.5 }}>
                <Typography variant="body2" component="span" fontWeight="bold">
                  {entity.entityId}
                </Typography>
                <Typography
                  variant="body2"
                  component="span"
                  color="text.secondary"
                >
                  {", "}
                  {entity.reason}
                  {entity.failedAt ? ` (${timeAgo(entity.failedAt)})` : ""}
                </Typography>
              </Box>
            ))}
          </Box>
        </Alert>
      </CardContent>
    </Card>
  );
};
