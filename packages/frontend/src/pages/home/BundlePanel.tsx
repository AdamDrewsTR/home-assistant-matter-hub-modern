import type {
  BridgeDataWithMetadata,
  EntityMappingConfig,
  MatterDeviceType,
} from "@home-assistant-matter-hub/common";
import {
  domainToDefaultMatterTypes,
  matterDeviceTypeLabels,
} from "@home-assistant-matter-hub/common";
import Add from "@mui/icons-material/Add";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useBeforeUnload, useBlocker } from "react-router";
import { createBackupSnapshot } from "../../api/backup.ts";
import { fetchBridges } from "../../api/bridges.ts";
import {
  fetchEntityMappings,
  updateEntityMapping,
} from "../../api/entity-mappings.ts";
import {
  fetchHomeEntities,
  type HomeEntity,
} from "../../api/home-inventory.ts";
import {
  ControllerSupportChips,
  controllerSupportWarning,
} from "../../components/entity-mapping/ControllerSupportChips.tsx";
import { ConfirmDialog } from "../../components/misc/ConfirmDialog.tsx";
import { navigation } from "../../routes.tsx";
import {
  type DeviceBundle,
  mappedEntities,
  suggestBundles,
  validateBundle,
} from "./bundles.ts";
import { ChangePlanContent } from "./ChangePlan.tsx";
import { DeviceEditor } from "./DeviceEditor.tsx";
import { selectedEntities } from "./sharing.ts";

export function BundlePanel({ bridge }: { bridge: BridgeDataWithMetadata }) {
  const { t } = useTranslation();
  const [inventory, setInventory] = useState<HomeEntity[]>([]);
  const [mappings, setMappings] = useState<EntityMappingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<DeviceBundle>();
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState(false);
  const [primary, setPrimary] = useState<HomeEntity | null>(null);
  const [parts, setParts] = useState<HomeEntity[]>([]);
  const [types, setTypes] = useState<Record<string, MatterDeviceType>>({});
  const [name, setName] = useState("");
  const [filterLife, setFilterLife] = useState<HomeEntity | null>(null);
  const [editing, setEditing] = useState<EntityMappingConfig>();
  const [snapshot, setSnapshot] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const blocker = useBlocker(saving || !!editing);
  useBeforeUnload((event) => {
    if (saving) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  useEffect(() => {
    if (blocker.state === "blocked" && !saving && !editing) {
      if (success) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker, saving, success, editing]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [entities, result] = await Promise.all([
        fetchHomeEntities(),
        fetchEntityMappings(bridge.id),
      ]);
      setInventory(entities);
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
  const shared = selectedEntities(bridge.filter);
  const candidates = inventory.filter(
    (entity) =>
      !entity.disabled &&
      !entity.hidden &&
      entity.domain in domainToDefaultMatterTypes,
  );
  const suggestions = suggestBundles(inventory, mappings);
  const existing = mappings.filter(
    (mapping) =>
      mapping.composedEntities?.length || mappedEntities(mapping).length > 1,
  );
  const label = (id: string) =>
    inventory.find((entity) => entity.entity_id === id)?.friendly_name || id;
  const sharedPrimary = (bundle: DeviceBundle) =>
    shared?.includes(bundle.primary) === true;
  const customTypes = (entity: HomeEntity) =>
    Object.entries(domainToDefaultMatterTypes).find(
      ([domain]) => domain === entity.domain,
    )?.[1] ?? [];
  const customValid =
    primary && parts.length && parts.every((entity) => types[entity.entity_id]);

  function showPreview(bundle: DeviceBundle) {
    setError(undefined);
    setSuccess(false);
    setApproved(false);
    setFilterLife(null);
    setPreview(bundle);
  }
  async function apply() {
    if (!preview || !approved || saving) return;
    setSaving(true);
    setSuccess(false);
    setError(undefined);
    try {
      const [entities, latest, hubs] = await Promise.all([
        fetchHomeEntities(),
        fetchEntityMappings(bridge.id),
        fetchBridges(),
      ]);
      const hub = hubs.find((item) => item.id === bridge.id);
      if (
        !hub ||
        hub.featureFlags?.serverMode ||
        !selectedEntities(hub.filter)?.includes(preview.primary)
      )
        throw new Error(t("bundles.shareFirst"));
      const reviewed = filterLife
        ? { ...preview, members: [...preview.members, filterLife.entity_id] }
        : preview;
      const issue = validateBundle(reviewed, entities, latest.mappings);
      if (issue) throw new Error(t(`bundles.validation.${issue}`));
      const mapping = {
        ...preview.mapping,
        ...(filterLife && { filterLifeEntity: filterLife.entity_id }),
      };
      if (snapshot) {
        await createBackupSnapshot();
        setSnapshot(false);
      }
      await updateEntityMapping(bridge.id, preview.primary, {
        ...mapping,
        onlyIfUnmapped: true,
      });
      setPreview(undefined);
      setCustom(false);
      setSuccess(true);
      await load();
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : String(cause)} ${t("bundles.checkAfterFailure")}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      {editing &&
        inventory.find((entity) => entity.entity_id === editing.entityId) && (
          <DeviceEditor
            key={editing.entityId}
            entity={
              inventory.find((entity) => entity.entity_id === editing.entityId)!
            }
            inventory={inventory}
            mapping={editing}
            bridge={bridge}
            onBusyChange={setEditorBusy}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setSuccess(true);
              void load();
            }}
          />
        )}
      <ConfirmDialog
        open={blocker.state === "blocked" && !!editing && !editorBusy}
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
      <Box>
        <Typography variant="h2">{t("bundles.title")}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {t("bundles.description")}
        </Typography>
      </Box>
      <Alert severity="info">{t("bundles.optIn")}</Alert>
      {bridge.featureFlags?.serverMode && (
        <Alert severity="warning">{t("bundles.standalone")}</Alert>
      )}
      {error && !preview && (
        <Alert
          severity="error"
          action={<Button onClick={load}>{t("modern.retry")}</Button>}
        >
          {error}
        </Alert>
      )}
      {success && <Alert severity="success">{t("bundles.saved")}</Alert>}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          startIcon={<Add />}
          disabled={loading || !!error || bridge.featureFlags?.serverMode}
          onClick={() => {
            setCustom(true);
            setPrimary(null);
            setParts([]);
            setTypes({});
            setName("");
          }}
        >
          {t("bundles.custom")}
        </Button>
        <Button
          component={Link}
          to={navigation.hub(bridge.id, "advanced", "mappings")}
        >
          {t("bundles.manageMappings")}
        </Button>
      </Stack>
      {loading ? (
        <CircularProgress aria-label={t("common.loading")} />
      ) : (
        <>
          {existing.length > 0 && (
            <Stack spacing={2}>
              <Typography variant="h3">{t("bundles.existing")}</Typography>
              {existing.map((mapping) => (
                <Card key={mapping.entityId} variant="outlined" sx={{ p: 2.5 }}>
                  <Typography fontWeight={600}>
                    {mapping.customName || label(mapping.entityId)}
                  </Typography>
                  {inventory.some(
                    (entity) => entity.entity_id === mapping.entityId,
                  ) ? (
                    <Button sx={{ mt: 1 }} onClick={() => setEditing(mapping)}>
                      {t("deviceWorkspace.editBundle")}
                    </Button>
                  ) : (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {t("deviceWorkspace.health.missing")}
                    </Alert>
                  )}
                  <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
                    {mappedEntities(mapping).map((id) => (
                      <Chip key={id} size="small" label={label(id)} />
                    ))}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
          <Typography variant="h3">{t("bundles.suggested")}</Typography>
          {!suggestions.length && (
            <Typography color="text.secondary">{t("bundles.none")}</Typography>
          )}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              gap: 2,
            }}
          >
            {suggestions.map((bundle) => (
              <Card
                key={`${bundle.kind}/${bundle.primary}`}
                variant="outlined"
                sx={{ p: 3 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoAwesome color="primary" />
                  <Typography variant="h3">
                    {t(`bundles.kind.${bundle.kind}`)}
                  </Typography>
                </Stack>
                <Typography sx={{ my: 1 }}>
                  {inventory.find(
                    (entity) => entity.entity_id === bundle.primary,
                  )?.device_name || label(bundle.primary)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("bundles.sameDevice")}
                </Typography>
                <Stack gap={1} direction="row" flexWrap="wrap" sx={{ my: 2 }}>
                  {bundle.members.map((id) => (
                    <Chip
                      key={id}
                      label={label(id)}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
                <Button
                  variant="outlined"
                  disabled={bridge.featureFlags?.serverMode}
                  onClick={() => showPreview(bundle)}
                >
                  {t("bundles.preview")}
                </Button>
              </Card>
            ))}
          </Box>
        </>
      )}
      <Dialog
        open={custom}
        onClose={() => !saving && setCustom(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{t("bundles.custom")}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              label={t("bundles.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Autocomplete
              options={candidates}
              getOptionLabel={(entity) =>
                `${entity.friendly_name || entity.entity_id} (${entity.entity_id})`
              }
              value={primary}
              onChange={(_, entity) => {
                setPrimary(entity);
                setParts([]);
                setTypes({});
              }}
              renderInput={(props) => (
                <TextField {...props} label={t("bundles.primary")} />
              )}
            />
            {primary && (
              <TextField
                select
                label={t("bundles.primaryType")}
                value={types[primary.entity_id] ?? ""}
                onChange={(event) => {
                  const next = { ...types };
                  if (event.target.value)
                    next[primary.entity_id] = event.target
                      .value as MatterDeviceType;
                  else delete next[primary.entity_id];
                  setTypes(next);
                }}
              >
                <MenuItem value="">{t("bundles.automaticType")}</MenuItem>
                {customTypes(primary).map((type) => (
                  <MenuItem key={type} value={type}>
                    {matterDeviceTypeLabels[type]}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Autocomplete
              multiple
              options={candidates.filter(
                (entity) => entity.entity_id !== primary?.entity_id,
              )}
              getOptionLabel={(entity) =>
                `${entity.friendly_name || entity.entity_id} (${entity.entity_id})`
              }
              value={parts}
              onChange={(_, values) => setParts(values)}
              renderInput={(props) => (
                <TextField {...props} label={t("bundles.members")} />
              )}
            />
            {parts.map((entity) => (
              <TextField
                key={entity.entity_id}
                select
                label={label(entity.entity_id)}
                value={types[entity.entity_id] || ""}
                onChange={(event) =>
                  setTypes({
                    ...types,
                    [entity.entity_id]: event.target.value as MatterDeviceType,
                  })
                }
              >
                {customTypes(entity).map((type) => (
                  <MenuItem key={type} value={type}>
                    {matterDeviceTypeLabels[type]}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustom(false)}>{t("common.cancel")}</Button>
          <Button
            disabled={!customValid}
            onClick={() => {
              if (!primary) return;
              const bundle: DeviceBundle = {
                kind: "custom",
                primary: primary.entity_id,
                members: [
                  primary.entity_id,
                  ...parts.map((entity) => entity.entity_id),
                ],
                mapping: {
                  entityId: primary.entity_id,
                  composeDevice: true,
                  ...(name.trim() && { customName: name.trim() }),
                  ...(types[primary.entity_id] && {
                    matterDeviceType: types[primary.entity_id],
                  }),
                  composedEntities: parts.map((entity) => ({
                    entityId: entity.entity_id,
                    matterDeviceType: types[entity.entity_id],
                  })),
                },
              };
              showPreview(bundle);
            }}
          >
            {t("bundles.preview")}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!preview}
        onClose={() => !saving && setPreview(undefined)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{t("bundles.previewTitle")}</DialogTitle>
        <DialogContent>
          {preview && (
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography fontWeight={600}>
                {preview.mapping.customName || label(preview.primary)}
              </Typography>
              <Typography>
                {t("bundles.primaryValue", { name: preview.primary })}
              </Typography>
              {preview.mapping.matterDeviceType && (
                <Box>
                  <ControllerSupportChips
                    detailed
                    type={preview.mapping.matterDeviceType}
                  />
                  <Typography variant="body2">
                    {controllerSupportWarning(preview.mapping.matterDeviceType)}
                  </Typography>
                </Box>
              )}
              {preview.members.map((id) => (
                <Box key={id}>
                  <Typography>{label(id)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {id}
                  </Typography>
                  {preview.mapping.composedEntities
                    ?.filter(
                      (part) => part.entityId === id && part.matterDeviceType,
                    )
                    .map((part) => (
                      <Box key={part.entityId}>
                        <ControllerSupportChips
                          detailed
                          type={part.matterDeviceType!}
                        />
                        <Typography variant="caption" display="block">
                          {controllerSupportWarning(part.matterDeviceType!)}
                        </Typography>
                      </Box>
                    ))}
                </Box>
              ))}
              {preview.kind === "purifier" && (
                <>
                  <Alert severity="warning">
                    {t("bundles.purifierWarning")}
                  </Alert>
                  <Autocomplete
                    options={inventory.filter(
                      (entity) =>
                        entity.domain === "sensor" &&
                        entity.device_id ===
                          inventory.find(
                            (item) => item.entity_id === preview.primary,
                          )?.device_id &&
                        entity.attributes?.unit_of_measurement === "%" &&
                        !entity.disabled &&
                        !preview.members.includes(entity.entity_id),
                    )}
                    getOptionLabel={(entity) =>
                      `${label(entity.entity_id)} (${entity.entity_id})`
                    }
                    value={filterLife}
                    onChange={(_, entity) => setFilterLife(entity)}
                    renderInput={(props) => (
                      <TextField {...props} label={t("bundles.filterLife")} />
                    )}
                  />
                </>
              )}
              {validateBundle(preview, inventory, mappings) && (
                <Alert severity="error">
                  {t(
                    `bundles.validation.${validateBundle(preview, inventory, mappings)}`,
                  )}
                </Alert>
              )}
              {!sharedPrimary(preview) && (
                <Alert severity="warning">{t("bundles.shareFirst")}</Alert>
              )}
              <Alert severity="warning">
                {t(
                  bridge.commissioning?.isCommissioned
                    ? "bundles.pairedWarning"
                    : "bundles.previewWarning",
                )}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                {t("bundles.controllerNote")}
              </Typography>
              <Box
                component="fieldset"
                disabled={saving}
                sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
              >
                <ChangePlanContent
                  before={[preview.primary]}
                  after={[
                    ...new Set([
                      ...preview.members,
                      ...(filterLife ? [filterLife.entity_id] : []),
                    ]),
                  ]}
                  snapshot={snapshot}
                  onSnapshotChange={setSnapshot}
                />
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={approved}
                    disabled={saving}
                    onChange={(_, checked) => setApproved(checked)}
                  />
                }
                label={t("bundles.approve")}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setPreview(undefined)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={
              !preview ||
              saving ||
              !approved ||
              !sharedPrimary(preview) ||
              !!validateBundle(preview, inventory, mappings) ||
              bridge.featureFlags?.serverMode
            }
            onClick={apply}
          >
            {t(saving ? "modern.saving" : "bundles.apply")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
