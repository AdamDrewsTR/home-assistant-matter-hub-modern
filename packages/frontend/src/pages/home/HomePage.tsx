import type { BridgeDataWithMetadata } from "@home-assistant-matter-hub/common";
import Add from "@mui/icons-material/Add";
import ArrowForward from "@mui/icons-material/ArrowForward";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import type { Theme } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useLocation,
  useSearchParams,
} from "react-router";
import { fetchBridges } from "../../api/bridges.ts";
import { fetchSharingSelection } from "../../api/home-inventory.ts";
import {
  FabricsCard,
  PairingCard,
} from "../../components/bridge/BridgeDetails.tsx";
import { ConfirmDialog } from "../../components/misc/ConfirmDialog.tsx";
import { useBridges, useUpdateBridge } from "../../hooks/data/bridges.ts";
import { navigation } from "../../routes.tsx";
import { loadBridges } from "../../state/bridges/bridge-actions.ts";
import { useAppDispatch } from "../../state/hooks.ts";
import { bridgeToConfig } from "../edit-bridge/bridge-to-config.ts";
import { ChangePlanDialog } from "./ChangePlan.tsx";
import { EntityPicker } from "./EntityPicker.tsx";
import { PairingChecklist } from "./PairingChecklist.tsx";
import { selectedEntities, selectionFilter } from "./sharing.ts";

const BundlePanel = lazy(() =>
  import("./BundlePanel.tsx").then((module) => ({
    default: module.BundlePanel,
  })),
);
const DeviceHealth = lazy(() =>
  import("./DeviceHealth.tsx").then((module) => ({
    default: module.DeviceHealth,
  })),
);
const HubAdvanced = lazy(() =>
  import("./HubAdvanced.tsx").then((module) => ({
    default: module.HubAdvanced,
  })),
);

function HubSharing({ bridge }: { bridge: BridgeDataWithMetadata }) {
  const { t } = useTranslation();
  const updateBridge = useUpdateBridge();
  const [baseline, setBaseline] = useState(bridge.filter);
  const original = selectedEntities(baseline);
  const [resolved, setResolved] = useState<string[]>();
  const [editingRules, setEditingRules] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string>();
  const [resolutionAttempt, setResolutionAttempt] = useState(0);
  const [selection, setSelection] = useState<string[]>(original ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [review, setReview] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const dirty =
    editingRules ||
    (original !== null &&
      JSON.stringify([...selection].sort()) !==
        JSON.stringify([...original].sort()));
  const ruleBased = original === null;
  const readOnly =
    bridge.featureFlags?.serverMode || (ruleBased && !editingRules);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry reloads the same rules without altering them.
  useEffect(() => {
    if (selectedEntities(baseline) !== null) return;
    const controller = new AbortController();
    setResolving(true);
    setResolveError(undefined);
    setResolved(undefined);
    fetchSharingSelection(baseline, controller.signal)
      .then((ids) => {
        if (controller.signal.aborted) return;
        setResolved(ids);
        setSelection(ids);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setResolveError(
            cause instanceof Error ? cause.message : String(cause),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolving(false);
      });
    return () => controller.abort();
  }, [baseline, resolutionAttempt]);

  const remoteChanged =
    JSON.stringify(bridge.filter) !== JSON.stringify(baseline);
  const blocker = useBlocker(dirty || saving || deviceOpen);
  useEffect(() => {
    if (blocker.state === "blocked" && !saving && !dirty && !deviceOpen)
      blocker.proceed();
  }, [blocker, saving, dirty, deviceOpen]);
  useBeforeUnload((event) => {
    if (dirty || saving) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const current = (await fetchBridges()).find(
        (item) => item.id === bridge.id,
      );
      if (
        !current ||
        JSON.stringify(current.filter) !== JSON.stringify(baseline) ||
        current.featureFlags?.serverMode
      )
        throw new Error(t("modern.remoteChanged"));
      const updated = await updateBridge({
        ...bridgeToConfig(current),
        id: bridge.id,
        filter: selectionFilter(selection),
      });
      setBaseline(updated.filter);
      setSelection(selectedEntities(updated.filter) ?? []);
      setSaved(true);
      setEditingRules(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("modern.saveFailed"));
      throw cause;
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      {ruleBased && (
        <Alert
          severity="info"
          action={
            <Button component={Link} to={navigation.editBridge(bridge.id)}>
              {t("modern.editRules")}
            </Button>
          }
        >
          {t(editingRules ? "homeBrowser.converting" : "homeBrowser.rules")}
        </Alert>
      )}
      {ruleBased && !editingRules && (
        <Button
          variant="outlined"
          disabled={resolving || !resolved || bridge.featureFlags?.serverMode}
          onClick={() => setEditingRules(true)}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("homeBrowser.chooseDevices")}
        </Button>
      )}
      {bridge.featureFlags?.serverMode && (
        <Alert severity="info">{t("homeBrowser.standalone")}</Alert>
      )}
      {resolveError && (
        <Alert
          severity="error"
          action={
            <Button onClick={() => setResolutionAttempt((value) => value + 1)}>
              {t("modern.retry")}
            </Button>
          }
        >
          {resolveError}
        </Alert>
      )}
      {resolving && <CircularProgress aria-label={t("common.loading")} />}
      {review && (
        <ChangePlanDialog
          open
          before={original ?? resolved ?? []}
          after={selection}
          onClose={() => setReview(false)}
          onApply={save}
          onBusyChange={setSaving}
        />
      )}
      <ConfirmDialog
        open={blocker.state === "blocked" && !saving && !deviceBusy}
        title={t("modern.discardTitle")}
        message={t("modern.discardMessage")}
        confirmLabel={t("modern.discard")}
        cancelLabel={t("modern.stay")}
        onConfirm={() => {
          if (blocker.state === "blocked") blocker.proceed();
        }}
        onCancel={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
      />
      {error && <Alert severity="error">{error}</Alert>}
      {remoteChanged && (
        <Alert
          severity="warning"
          action={
            <Button
              onClick={() => {
                setBaseline(bridge.filter);
                setSelection(selectedEntities(bridge.filter) ?? []);
                setSaved(false);
                setEditingRules(false);
              }}
            >
              {t("modern.reloadSelection")}
            </Button>
          }
        >
          {t("modern.remoteChanged")}
        </Alert>
      )}
      {saved && !dirty && <Alert severity="success">{t("modern.saved")}</Alert>}
      <EntityPicker
        bridge={bridge}
        onEditorOpenChange={setDeviceOpen}
        onEditorBusyChange={setDeviceBusy}
        selected={selection}
        onChange={(value) => {
          setSelection(value);
          setSaved(false);
        }}
        disabled={saving || readOnly || (ruleBased && !resolved)}
      />
      {dirty && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          sx={{
            position: "sticky",
            bottom: 16,
            zIndex: 2,
            p: 2.5,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "primary.main",
            borderRadius: 3,
            boxShadow: 8,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={600}>
              {t("modern.selectedCount", { count: selection.length })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(
                selection.length
                  ? "modern.pendingChanges"
                  : "modern.removeAllWarning",
              )}
            </Typography>
          </Box>
          <Button
            disabled={saving}
            onClick={() => {
              setSelection(original ?? resolved ?? []);
              setEditingRules(false);
            }}
          >
            {t("modern.discard")}
          </Button>
          <Button
            variant="contained"
            disabled={saving || remoteChanged}
            onClick={() => setReview(true)}
          >
            {t(saving ? "modern.saving" : "modern.applyChanges")}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { content: bridges, isLoading, error } = useBridges();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const [params, setParams] = useSearchParams();
  const bridge = params.has("hub")
    ? bridges?.find((item) => item.id === params.get("hub"))
    : bridges?.[0];
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const requestedView = params.get("view") ?? "devices";
  const view = ["pair", "bundles", "advanced", "health"].includes(requestedView)
    ? requestedView
    : "devices";

  useEffect(() => {
    const timer = setInterval(() => dispatch(loadBridges()), 15000);
    return () => clearInterval(timer);
  }, [dispatch]);
  useEffect(() => {
    if (location.state?.focusWorkspace) {
      window.scrollTo(0, 0);
      heading.current?.focus({ preventScroll: true });
    }
  }, [location.state]);

  return (
    <Stack spacing={{ xs: 2.5, sm: 4 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h1" ref={heading} tabIndex={-1}>
            {t("homeBrowser.title")}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{
              mt: { xs: 0.5, sm: 1.5 },
              fontSize: { xs: "0.9375rem", sm: "1rem" },
            }}
          >
            {t("homeBrowser.subtitle")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {bridges && bridges.length > 0 && (
            <TextField
              select
              label={t("modern.currentHub")}
              value={bridge?.id ?? ""}
              size={compact ? "small" : "medium"}
              sx={{ minWidth: { xs: 0, sm: 180 }, flex: { xs: 1, sm: "none" } }}
              onChange={(event) =>
                setParams({
                  hub: event.target.value,
                  view,
                  ...(params.get("section") && {
                    section: params.get("section")!,
                  }),
                })
              }
            >
              {bridges.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Button
            component={Link}
            to="/setup"
            variant={bridge ? "outlined" : "contained"}
            startIcon={<Add />}
            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {t("modern.addHub")}
          </Button>
        </Stack>
      </Stack>
      {error && (
        <Alert
          severity="error"
          action={
            <Button onClick={() => dispatch(loadBridges())}>
              {t("modern.retry")}
            </Button>
          }
        >
          {error.message || t("modern.loadFailed")}
        </Alert>
      )}
      {!bridges && isLoading && (
        <CircularProgress aria-label={t("common.loading")} />
      )}
      {bridges?.length && !bridge ? (
        <Alert
          severity="warning"
          action={
            <Button component={Link} to="/">
              {t("modern.backHome")}
            </Button>
          }
        >
          {t("common.notFound")}
        </Alert>
      ) : null}
      {bridges && !bridges.length && (
        <Card
          variant="outlined"
          sx={{ p: { xs: 4, md: 8 }, textAlign: "center" }}
        >
          <HomeOutlined color="primary" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h2">{t("modern.welcomeTitle")}</Typography>
          <Typography
            color="text.secondary"
            sx={{ my: 3, maxWidth: 550, mx: "auto" }}
          >
            {t("modern.welcomeDescription")}
          </Typography>
          <Button
            component={Link}
            to="/setup"
            variant="contained"
            endIcon={<ArrowForward />}
          >
            {t("modern.getStarted")}
          </Button>
        </Card>
      )}
      {bridge && (
        <>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            {[
              [t("modern.sharedDevices"), bridge.deviceCount],
              [t("modern.hubStatus"), t(`common.${bridge.status}`)],
              [
                t("modern.connectedApps"),
                bridge.commissioning?.fabrics.length ?? 0,
              ],
            ].map(([label, value]) => (
              <Chip
                key={label}
                variant="outlined"
                size={compact ? "small" : "medium"}
                label={`${label}: ${value}`}
              />
            ))}
          </Box>
          {bridge.statusReason && (
            <Alert severity={bridge.status === "failed" ? "error" : "info"}>
              {bridge.statusReason}
            </Alert>
          )}
          {!!bridge.failedEntities?.length && (
            <Alert
              severity="warning"
              action={
                <Button
                  component={Link}
                  to={navigation.hub(bridge.id, "advanced", "diagnostics")}
                >
                  {t("modern.details")}
                </Button>
              }
            >
              {t("modern.failedCount", { count: bridge.failedEntities.length })}
            </Alert>
          )}
          {!bridge.commissioning?.isCommissioned && (
            <Alert
              severity="info"
              action={
                <Button
                  onClick={() => setParams({ hub: bridge.id, view: "pair" })}
                >
                  {t("modern.pairHub")}
                </Button>
              }
            >
              {t("modern.notPaired")}
            </Alert>
          )}
          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{
                mb: { xs: 2, sm: 3 },
                mx: { xs: -2, sm: 0 },
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Tabs
                value={view}
                variant="scrollable"
                scrollButtons="auto"
                onChange={(_, value: string) =>
                  setParams({ hub: bridge.id, view: value })
                }
                aria-label={t("modern.hubViews")}
                sx={{
                  minWidth: 0,
                  minHeight: { xs: 44, sm: 48 },
                  "& .MuiTabs-scrollButtons": { width: 28 },
                  "& .MuiTabs-scrollButtons.Mui-disabled": { opacity: 0.3 },
                  "& .MuiTab-root": {
                    minWidth: 0,
                    minHeight: { xs: 44, sm: 48 },
                    px: { xs: 1.25, sm: 2 },
                    textTransform: { xs: "none", sm: "uppercase" },
                    fontSize: { xs: "0.875rem", sm: "0.875rem" },
                  },
                }}
              >
                <Tab
                  value="devices"
                  label={
                    compact ? t("modern.tabs.devices") : t("modern.yourDevices")
                  }
                />
                <Tab
                  value="pair"
                  label={compact ? t("modern.tabs.pair") : t("modern.pairing")}
                />
                <Tab
                  value="bundles"
                  label={
                    compact ? t("modern.tabs.bundles") : t("bundles.title")
                  }
                />
                <Tab
                  value="health"
                  label={
                    compact
                      ? t("modern.tabs.health")
                      : t("deviceWorkspace.health.title")
                  }
                />
                <Tab value="advanced" label={t("modern.advanced")} />
              </Tabs>
            </Stack>
            {view === "devices" ? (
              <HubSharing key={bridge.id} bridge={bridge} />
            ) : view === "bundles" ? (
              <Suspense fallback={<CircularProgress />}>
                <BundlePanel key={bridge.id} bridge={bridge} />
              </Suspense>
            ) : view === "health" ? (
              <Suspense fallback={<CircularProgress />}>
                <DeviceHealth key={bridge.id} bridge={bridge} />
              </Suspense>
            ) : view === "advanced" ? (
              <Suspense fallback={<CircularProgress />}>
                <HubAdvanced key={bridge.id} bridge={bridge} />
              </Suspense>
            ) : (
              <Stack spacing={3}>
                <PairingChecklist key={bridge.id} bridge={bridge} />
                <Typography color="text.secondary">
                  {t("modern.pairDescription")}
                </Typography>
                <Box sx={{ maxWidth: 520 }}>
                  <PairingCard key={bridge.id} bridge={bridge} />
                </Box>
                <FabricsCard bridge={bridge} />
                <Button
                  variant="contained"
                  sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
                  onClick={() =>
                    setParams(
                      { hub: bridge.id, view: "devices" },
                      { replace: true, state: { focusWorkspace: true } },
                    )
                  }
                >
                  {t("modern.finishSetup")}
                </Button>
              </Stack>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
}
