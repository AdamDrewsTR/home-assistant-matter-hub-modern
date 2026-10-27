import {
  type BridgeDataWithMetadata,
  type EntityMappingConfig,
  type MatterDeviceType,
  matterDeviceTypeLabels,
} from "@home-assistant-matter-hub/common";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBeforeUnload } from "react-router";
import { createBackupSnapshot } from "../../api/backup.ts";
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
import { mappedEntities, validateBundle } from "./bundles.ts";
import { ChangePlanContent, mappingChanges } from "./ChangePlan.tsx";
import { capabilityType } from "./capabilities.ts";

type CompanionKey =
  | "batteryEntity"
  | "temperatureEntity"
  | "humidityEntity"
  | "pressureEntity"
  | "powerEntity"
  | "energyEntity"
  | "voltageEntity"
  | "currentEntity"
  | "filterLifeEntity";
const companionClasses: Record<CompanionKey, string[]> = {
  batteryEntity: ["battery"],
  temperatureEntity: ["temperature"],
  humidityEntity: ["humidity"],
  pressureEntity: ["pressure", "atmospheric_pressure"],
  powerEntity: ["power"],
  energyEntity: ["energy"],
  voltageEntity: ["voltage"],
  currentEntity: ["current"],
  filterLifeEntity: [],
};
export function DeviceEditor({
  entity,
  inventory,
  mapping,
  bridge,
  onClose,
  onSaved,
  shared,
  onSharedChange,
  onBusyChange,
}: {
  entity: HomeEntity;
  inventory: HomeEntity[];
  mapping?: EntityMappingConfig;
  bridge: BridgeDataWithMetadata;
  onClose: () => void;
  onSaved: () => void;
  shared?: boolean;
  onSharedChange?: (shared: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(
    () => () => {
      // The editor unmounts with its dialog; restore after focus-trap cleanup.
      queueMicrotask(() => {
        const target = opener?.isConnected
          ? opener
          : document.querySelector<HTMLElement>("h1");
        target?.focus({ preventScroll: true });
      });
    },
    [opener],
  );
  const baseline = mapping ?? { entityId: entity.entity_id };
  const [draft, setDraft] = useState<EntityMappingConfig>(baseline);
  const [bundleOpen, setBundleOpen] = useState(
    !!mapping?.composedEntities?.length,
  );
  const [willShare, setWillShare] = useState(shared ?? false);
  const [review, setReview] = useState(false);
  const [approved, setApproved] = useState(false);
  const [snapshot, setSnapshot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(baseline) ||
    (onSharedChange && shared !== willShare);
  useEffect(() => {
    onBusyChange?.(saving);
    return () => onBusyChange?.(false);
  }, [saving, onBusyChange]);
  useBeforeUnload((event) => {
    if (dirty || saving) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  const [discard, setDiscard] = useState(false);
  const type = capabilityType(entity, draft);
  const selectedIds = (draft.composedEntities ?? []).map(
    (part) => part.entityId,
  );
  const candidates = inventory.filter(
    (item) =>
      item.entity_id !== entity.entity_id && !item.disabled && !item.hidden,
  );
  const label = (id: string) =>
    inventory.find((item) => item.entity_id === id)?.friendly_name || id;
  const choices = Object.keys(matterDeviceTypeLabels) as MatterDeviceType[];
  function changeLabel(key: string) {
    if (key in companionClasses) return t(`deviceWorkspace.companion.${key}`);
    return t(`deviceWorkspace.fields.${key}`, {
      defaultValue: key.replace(/([a-z])([A-Z])/g, "$1 $2"),
    });
  }
  function changeValue(config: EntityMappingConfig, key: string) {
    const value = config[key as keyof EntityMappingConfig];
    if (value === undefined) return t("deviceWorkspace.plan.none");
    if (key === "composedEntities")
      return config.composedEntities
        ?.map(
          (part) =>
            `${label(part.entityId)} (${part.matterDeviceType ? matterDeviceTypeLabels[part.matterDeviceType] : t("bundles.automaticType")})`,
        )
        .join(", ");
    if (key === "matterDeviceType" && config.matterDeviceType)
      return matterDeviceTypeLabels[config.matterDeviceType];
    if (typeof value === "boolean")
      return t(value ? "deviceWorkspace.yes" : "deviceWorkspace.no");
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  function close() {
    if (saving) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function save() {
    if (!approved || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const [latest, entities] = await Promise.all([
        fetchEntityMappings(bridge.id),
        fetchHomeEntities(),
      ]);
      const before =
        latest.mappings.find((item) => item.entityId === entity.entity_id) ??
        null;
      if (JSON.stringify(before) !== JSON.stringify(mapping ?? null))
        throw new Error(t("deviceWorkspace.conflict"));
      if (
        selectedIds.length &&
        mappingChanges(baseline, draft).some(
          (change) =>
            change.key === "composedEntities" ||
            change.key === "composeDevice" ||
            change.key.endsWith("Entity"),
        )
      ) {
        const issue = validateBundle(
          {
            kind: "custom",
            primary: entity.entity_id,
            mapping: draft,
            members: [...new Set(mappedEntities(draft))],
          },
          entities,
          [],
        );
        if (issue) throw new Error(t(`bundles.validation.${issue}`));
      }
      if (snapshot) {
        await createBackupSnapshot();
        setSnapshot(false);
      }
      if (JSON.stringify(draft) !== JSON.stringify(baseline))
        await updateEntityMapping(bridge.id, entity.entity_id, {
          ...draft,
          expectedMapping: mapping ?? null,
        });
      if (onSharedChange && shared !== willShare) onSharedChange(willShare);
      onSaved();
      onClose();
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : String(cause)} ${t("bundles.checkAfterFailure")}`,
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onClose={close} fullWidth maxWidth="md">
      <DialogTitle>
        {t(
          review ? "deviceWorkspace.plan.title" : "deviceWorkspace.editTitle",
          { name: entity.friendly_name || entity.entity_id },
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {discard ? (
            <>
              <Alert severity="warning">{t("modern.discardMessage")}</Alert>
              <Button onClick={onClose}>{t("modern.discard")}</Button>
              <Button onClick={() => setDiscard(false)}>
                {t("modern.stay")}
              </Button>
            </>
          ) : review ? (
            <Box
              component="fieldset"
              disabled={saving}
              sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
            >
              <Stack spacing={2}>
                <Typography>
                  {draft.customName || entity.friendly_name || entity.entity_id}
                </Typography>
                <Typography>
                  {t("deviceWorkspace.typeChange", {
                    before: mapping?.matterDeviceType
                      ? matterDeviceTypeLabels[mapping.matterDeviceType]
                      : t("bundles.automaticType"),
                    after: draft.matterDeviceType
                      ? matterDeviceTypeLabels[draft.matterDeviceType]
                      : t("bundles.automaticType"),
                  })}
                </Typography>
                {mappingChanges(baseline, draft).map((change) => (
                  <Box key={change.key}>
                    <Typography fontWeight={600}>
                      {changeLabel(change.key)}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {changeValue(baseline, change.key)}
                      {" → "}
                      {changeValue(draft, change.key)}
                    </Typography>
                  </Box>
                ))}
                {onSharedChange && shared !== willShare && (
                  <Alert severity="info">
                    {t("deviceWorkspace.stagedSharing")}
                  </Alert>
                )}
                <ChangePlanContent
                  before={[...new Set(mappedEntities(baseline))]}
                  after={[...new Set(mappedEntities(draft))]}
                  snapshot={snapshot}
                  onSnapshotChange={setSnapshot}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approved}
                      onChange={(_, checked) => setApproved(checked)}
                    />
                  }
                  label={t("deviceWorkspace.plan.approve")}
                />
              </Stack>
            </Box>
          ) : (
            <>
              <Typography
                color="text.secondary"
                sx={{ overflowWrap: "anywhere" }}
              >
                {entity.entity_id}
              </Typography>
              {onSharedChange && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={willShare}
                      onChange={(_, checked) => setWillShare(checked)}
                    />
                  }
                  label={t("deviceWorkspace.share")}
                />
              )}
              {onSharedChange && (
                <Typography variant="caption" color="text.secondary">
                  {t("deviceWorkspace.stagedSharing")}
                </Typography>
              )}
              <TextField
                label={t("bundles.name")}
                value={draft.customName ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, customName: event.target.value })
                }
              />
              <TextField
                select
                label={t("bundles.primaryType")}
                value={draft.matterDeviceType ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    matterDeviceType: event.target.value
                      ? (event.target.value as MatterDeviceType)
                      : undefined,
                  })
                }
              >
                <MenuItem value="">{t("bundles.automaticType")}</MenuItem>
                {choices.map((key) => (
                  <MenuItem key={key} value={key}>
                    {matterDeviceTypeLabels[key]}
                  </MenuItem>
                ))}
              </TextField>
              {type ? (
                <>
                  <Typography>{matterDeviceTypeLabels[type]}</Typography>
                  <ControllerSupportChips detailed type={type} />
                  <Typography variant="caption">
                    {controllerSupportWarning(type)}
                  </Typography>
                </>
              ) : (
                <Alert severity="info">
                  {t("deviceWorkspace.unclassified")}
                </Alert>
              )}
              <Typography variant="caption" color="text.secondary">
                {t("deviceWorkspace.capabilityNote")}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!draft.disabled}
                    onChange={(_, checked) =>
                      setDraft({
                        ...draft,
                        disabled: checked ? undefined : true,
                      })
                    }
                  />
                }
                label={t("deviceWorkspace.enableMapping")}
              />
              <Box component="details">
                <Box component="summary" sx={{ cursor: "pointer", mb: 2 }}>
                  {t("deviceWorkspace.companions")}
                </Box>
                <Stack spacing={2}>
                  {(Object.keys(companionClasses) as CompanionKey[]).map(
                    (key) => (
                      <Autocomplete
                        key={key}
                        options={[
                          ...new Set([
                            ...(draft[key] ? [draft[key]!] : []),
                            ...candidates
                              .filter(
                                (item) =>
                                  item.domain === "sensor" &&
                                  (key === "filterLifeEntity"
                                    ? item.attributes?.unit_of_measurement ===
                                      "%"
                                    : companionClasses[key].includes(
                                        String(item.attributes?.device_class),
                                      )),
                              )
                              .map((item) => item.entity_id),
                          ]),
                        ]}
                        value={draft[key] ?? null}
                        getOptionLabel={(id) => `${label(id)} (${id})`}
                        onChange={(_, value) =>
                          setDraft({ ...draft, [key]: value ?? undefined })
                        }
                        renderInput={(props) => (
                          <TextField
                            {...props}
                            label={t(`deviceWorkspace.companion.${key}`)}
                          />
                        )}
                      />
                    ),
                  )}
                  <Alert severity="info">
                    {t("deviceWorkspace.companionNote")}
                  </Alert>
                </Stack>
              </Box>
              <Box
                component="details"
                open={bundleOpen}
                onToggle={(event) => setBundleOpen(event.currentTarget.open)}
              >
                <Box component="summary" sx={{ cursor: "pointer", mb: 2 }}>
                  {t("deviceWorkspace.bundle")}
                </Box>
                <Stack spacing={2}>
                  {bridge.featureFlags?.serverMode ? (
                    <Alert severity="warning">{t("bundles.standalone")}</Alert>
                  ) : (
                    <>
                      <Autocomplete
                        multiple
                        options={[
                          ...new Set([
                            ...selectedIds,
                            ...candidates.map((item) => item.entity_id),
                          ]),
                        ]}
                        getOptionLabel={(id) => `${label(id)} (${id})`}
                        value={selectedIds}
                        onChange={(_, values) =>
                          setDraft({
                            ...draft,
                            composeDevice: values.length ? true : undefined,
                            composedEntities: values.length
                              ? values.map(
                                  (id) =>
                                    draft.composedEntities?.find(
                                      (part) => part.entityId === id,
                                    ) ?? { entityId: id },
                                )
                              : undefined,
                          })
                        }
                        renderInput={(props) => (
                          <TextField {...props} label={t("bundles.members")} />
                        )}
                      />
                      {(draft.composedEntities ?? []).map((part) => (
                        <TextField
                          key={part.entityId}
                          select
                          label={label(part.entityId)}
                          value={part.matterDeviceType ?? ""}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              composedEntities: draft.composedEntities?.map(
                                (item) =>
                                  item.entityId === part.entityId
                                    ? {
                                        ...item,
                                        matterDeviceType: event.target.value
                                          ? (event.target
                                              .value as MatterDeviceType)
                                          : undefined,
                                      }
                                    : item,
                              ),
                            })
                          }
                        >
                          <MenuItem value="">
                            {t("bundles.automaticType")}
                          </MenuItem>
                          {choices.map((key) => (
                            <MenuItem key={key} value={key}>
                              {matterDeviceTypeLabels[key]}
                            </MenuItem>
                          ))}
                        </TextField>
                      ))}
                      {!!selectedIds.length && (
                        <Button
                          color="warning"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              composedEntities: undefined,
                              composeDevice: undefined,
                            })
                          }
                        >
                          {t("deviceWorkspace.unbundle")}
                        </Button>
                      )}
                    </>
                  )}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      {!discard && (
        <DialogActions>
          <Button
            disabled={saving}
            onClick={() => (review ? setReview(false) : close())}
          >
            {t(review ? "common.back" : "common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={saving || (review ? !approved : !dirty)}
            onClick={() => {
              if (review) void save();
              else {
                setReview(true);
                setApproved(false);
              }
            }}
          >
            {t(
              saving
                ? "modern.saving"
                : review
                  ? "modern.applyChanges"
                  : "deviceWorkspace.review",
            )}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
