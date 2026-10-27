import type {
  BridgeDataWithMetadata,
  EntityMappingConfig,
} from "@home-assistant-matter-hub/common";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useBlocker } from "react-router";
import { fetchEntityMappings } from "../../api/entity-mappings.ts";
import {
  fetchHomeEntities,
  type HomeEntity,
} from "../../api/home-inventory.ts";
import { ConfirmDialog } from "../../components/misc/ConfirmDialog.tsx";
import { navigation } from "../../routes.tsx";
import { deviceIssues } from "./capabilities.ts";
import { DeviceEditor } from "./DeviceEditor.tsx";
import { selectedEntities } from "./sharing.ts";

export function DeviceHealth({ bridge }: { bridge: BridgeDataWithMetadata }) {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<HomeEntity[]>([]);
  const [mappings, setMappings] = useState<EntityMappingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [controller, setController] = useState<
    "alexa" | "apple" | "google" | "smartthings" | "aqara"
  >("alexa");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<HomeEntity>();
  const [busy, setBusy] = useState(false);
  const blocker = useBlocker(!!editing);
  useEffect(() => {
    if (blocker.state === "blocked" && !editing) blocker.proceed();
  }, [blocker, editing]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [inventory, result] = await Promise.all([
        fetchHomeEntities(),
        fetchEntityMappings(bridge.id),
      ]);
      setEntities(inventory);
      setMappings(result.mappings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [bridge.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const issues = deviceIssues(
    entities,
    mappings,
    selectedEntities(bridge.filter),
    bridge.failedEntities ?? [],
    controller,
  ).filter((issue) =>
    `${issue.entityId} ${issue.detail ?? ""} ${t(`deviceWorkspace.health.${issue.kind}`)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <Stack spacing={2.5}>
      <Typography variant="h2">{t("deviceWorkspace.health.title")}</Typography>
      <Typography color="text.secondary">
        {t("deviceWorkspace.health.description")}
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label={t("deviceWorkspace.health.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <TextField
          select
          label={t("deviceWorkspace.pair.controller")}
          value={controller}
          sx={{ minWidth: 180 }}
          onChange={(event) =>
            setController(event.target.value as typeof controller)
          }
        >
          {["alexa", "apple", "google", "smartthings", "aqara"].map((item) => (
            <MenuItem key={item} value={item}>
              {t(`deviceWorkspace.controllers.${item}`)}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={load} disabled={loading}>
          {t("deviceWorkspace.refresh")}
        </Button>
      </Stack>
      {selectedEntities(bridge.filter) === null && (
        <Alert severity="info">{t("deviceWorkspace.health.ruleBased")}</Alert>
      )}
      {loading ? (
        <CircularProgress />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : issues.length ? (
        issues.map((issue) => (
          <Card
            key={`${issue.kind}/${issue.entityId}`}
            variant="outlined"
            sx={{ p: 2.5 }}
          >
            <Stack spacing={1}>
              <Typography fontWeight={600}>
                {t(`deviceWorkspace.health.${issue.kind}`)}
              </Typography>
              <Typography sx={{ overflowWrap: "anywhere" }}>
                {issue.entityId}
              </Typography>
              {issue.detail && (
                <Typography variant="body2" color="text.secondary">
                  {issue.detail}
                </Typography>
              )}
              <Typography variant="body2">
                {t(`deviceWorkspace.health.fix.${issue.kind}`)}
              </Typography>
              <Stack direction="row" spacing={1}>
                {entities.some(
                  (entity) => entity.entity_id === issue.entityId,
                ) && (
                  <Button
                    onClick={() =>
                      setEditing(
                        entities.find(
                          (entity) => entity.entity_id === issue.entityId,
                        ),
                      )
                    }
                  >
                    {t("deviceWorkspace.configure")}
                  </Button>
                )}
                <Button
                  component={Link}
                  to={navigation.hub(
                    bridge.id,
                    "advanced",
                    issue.kind === "failed" ? "diagnostics" : "mappings",
                  )}
                >
                  {t("modern.details")}
                </Button>
              </Stack>
            </Stack>
          </Card>
        ))
      ) : (
        <Alert severity="info">{t("deviceWorkspace.health.clear")}</Alert>
      )}
      {editing && (
        <DeviceEditor
          key={editing.entity_id}
          entity={editing}
          inventory={entities}
          mapping={mappings.find(
            (mapping) => mapping.entityId === editing.entity_id,
          )}
          bridge={bridge}
          onBusyChange={setBusy}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            void load();
          }}
        />
      )}
      <ConfirmDialog
        open={blocker.state === "blocked" && !busy}
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
    </Stack>
  );
}
