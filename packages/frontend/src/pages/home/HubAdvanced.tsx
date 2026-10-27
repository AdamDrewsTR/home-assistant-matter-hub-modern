import type {
  BridgeConfig,
  BridgeDataWithMetadata,
} from "@home-assistant-matter-hub/common";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBeforeUnload, useBlocker, useSearchParams } from "react-router";
import { exportBridge } from "../../api/bridge-export.ts";
import { BridgeConfigEditor } from "../../components/bridge/BridgeConfigEditor.tsx";
import {
  ControllerWarnings,
  FailedEntities,
  InfoCard,
} from "../../components/bridge/BridgeDetails.tsx";
import { DiagnosticsCard } from "../../components/bridge/DiagnosticsCard.tsx";
import { EndpointList } from "../../components/endpoints/EndpointList.tsx";
import { EntityMappingSection } from "../../components/entity-mapping/EntityMappingSection.tsx";
import { ConfirmDialog } from "../../components/misc/ConfirmDialog.tsx";
import { useUpdateBridge, useUsedPorts } from "../../hooks/data/bridges.ts";
import { useDevices } from "../../hooks/data/devices.ts";
import { loadDevices } from "../../state/devices/device-actions.ts";
import { useAppDispatch } from "../../state/hooks.ts";
import { BridgeMoreMenu } from "../bridge-details/BridgeMoreMenu.tsx";
import { bridgeToConfig } from "../edit-bridge/bridge-to-config.ts";

function HubConfiguration({ bridge }: { bridge: BridgeDataWithMetadata }) {
  const { t } = useTranslation();
  const update = useUpdateBridge();
  const usedPorts = useUsedPorts();
  const [baseline, setBaseline] = useState(() => bridgeToConfig(bridge));
  const [draft, setDraft] = useState<BridgeConfig>(baseline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const remoteChanged =
    JSON.stringify(bridgeToConfig(bridge)) !== JSON.stringify(baseline);
  const blocker = useBlocker(dirty || saving);
  useBeforeUnload((event) => {
    if (dirty || saving) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  useEffect(() => {
    if (blocker.state === "blocked" && !saving && !dirty) blocker.proceed();
  }, [blocker, saving, dirty]);
  function reset() {
    setDraft(baseline);
    setResetKey((value) => value + 1);
  }
  async function save(config: BridgeConfig) {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      if (remoteChanged) throw new Error(t("workspace.configChanged"));
      const result = await update({ ...config, id: bridge.id });
      setBaseline(bridgeToConfig(result));
      setDraft(bridgeToConfig(result));
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Stack spacing={2}>
      <ConfirmDialog
        open={blocker.state === "blocked" && !saving}
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
      {saved && !dirty && (
        <Alert severity="success">{t("workspace.configSaved")}</Alert>
      )}
      {remoteChanged && (
        <Alert
          severity="warning"
          action={
            <Button
              disabled={saving}
              onClick={() => {
                const config = bridgeToConfig(bridge);
                setBaseline(config);
                setDraft(config);
                setResetKey((key) => key + 1);
              }}
            >
              {t("modern.reloadSelection")}
            </Button>
          }
        >
          {t("workspace.configChanged")}
        </Alert>
      )}
      <Alert severity="warning">{t("workspace.configWarning")}</Alert>
      <Box
        component="fieldset"
        disabled={saving}
        sx={{ border: 0, p: 0, m: 0, minWidth: 0, opacity: saving ? 0.6 : 1 }}
      >
        <BridgeConfigEditor
          key={resetKey}
          bridgeId={bridge.id}
          bridge={baseline}
          usedPorts={usedPorts ?? {}}
          onSave={save}
          onCancel={reset}
          onDraftChange={setDraft}
        />
      </Box>
    </Stack>
  );
}

function HubDiagnostics({ bridgeId }: { bridgeId: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { content, error } = useDevices(bridgeId);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    dispatch(loadDevices(bridgeId));
    const timer = setInterval(() => dispatch(loadDevices(bridgeId)), 10000);
    return () => clearInterval(timer);
  }, [bridgeId, dispatch]);
  return (
    <Stack spacing={3}>
      <Button
        onClick={() => {
          dispatch(loadDevices(bridgeId));
          setRevision((value) => value + 1);
        }}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("common.refresh")}
      </Button>
      {error && <Alert severity="error">{error.message}</Alert>}
      {content && (
        <>
          <DiagnosticsCard devices={content} />
          <EndpointList
            key={revision}
            endpoint={content}
            bridgeId={bridgeId}
            onMappingSaved={() => setRevision((value) => value + 1)}
          />
        </>
      )}
    </Stack>
  );
}

export function HubAdvanced({ bridge }: { bridge: BridgeDataWithMetadata }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState<string>();
  const sections = useMemo(
    () => ["configuration", "mappings", "diagnostics", "maintenance"],
    [],
  );
  const section = sections.includes(params.get("section") ?? "")
    ? params.get("section")!
    : "configuration";
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h2">{t("workspace.hubAdvanced")}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {t("workspace.advancedDescription")}
          </Typography>
        </Box>
        <TextField
          select
          label={t("workspace.section")}
          value={section}
          onChange={(event) =>
            setParams({
              hub: bridge.id,
              view: "advanced",
              section: event.target.value,
            })
          }
          sx={{ minWidth: 210 }}
        >
          {sections.map((key) => (
            <MenuItem key={key} value={key}>
              {t(`workspace.${key}`)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {section === "configuration" && <HubConfiguration bridge={bridge} />}
      {section === "mappings" && <EntityMappingSection bridgeId={bridge.id} />}
      {section === "diagnostics" && (
        <>
          <FailedEntities bridge={bridge} />
          <ControllerWarnings bridge={bridge} />
          <HubDiagnostics bridgeId={bridge.id} />
        </>
      )}
      {section === "maintenance" && (
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}
          <InfoCard bridge={bridge} />
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
              {t("workspace.lifecycle")}
            </Typography>
            <Typography color="text.secondary">
              {t("workspace.lifecycleDescription")}
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              sx={{ mt: 2 }}
              alignItems="center"
            >
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    await exportBridge(bridge.id);
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : String(cause),
                    );
                  }
                }}
              >
                {t("common.export")}
              </Button>
              <BridgeMoreMenu bridge={bridge.id} />
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
