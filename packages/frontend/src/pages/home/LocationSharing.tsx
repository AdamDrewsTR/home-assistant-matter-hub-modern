import type { LocationSharing as LocationSharingConfig } from "@home-assistant-matter-hub/common";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchHomeEntities,
  fetchLocations,
  fetchSharingSelection,
  type HomeEntity,
} from "../../api/home-inventory.ts";
import { groupHomeDevices } from "./device-groups.ts";
import { locationFilter } from "./sharing.ts";

interface LocationOption {
  id: string;
  kind: "room" | "floor";
  name: string;
  missing?: boolean;
}

export function LocationSharing({
  value,
  onChange,
  onPreview,
  disabled,
  onSummary,
}: {
  value: LocationSharingConfig;
  onChange: (value: LocationSharingConfig) => void;
  onPreview: (ids: string[] | undefined) => void;
  disabled?: boolean;
  onSummary?: (summary: string) => void;
}) {
  const { t } = useTranslation();
  const [inventory, setInventory] = useState<{
    options: LocationOption[];
    entities: HomeEntity[];
  }>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<string[]>();
  const [previewError, setPreviewError] = useState<string>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry explicitly reloads the same inventory.
  useEffect(() => {
    const controller = new AbortController();
    setError(undefined);
    Promise.all([
      fetchLocations(controller.signal),
      fetchHomeEntities(controller.signal),
    ])
      .then(([locations, entities]) => {
        if (!controller.signal.aborted)
          setInventory({
            options: [
              ...locations.floors.map((floor) => ({
                id: floor.floor_id,
                name: floor.name,
                kind: "floor" as const,
              })),
              ...locations.areas.map((area) => ({
                id: area.area_id,
                name: area.name,
                kind: "room" as const,
              })),
            ],
            entities,
          });
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => controller.abort();
  }, [attempt]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry also repeats a failed preview without changing the rule.
  useEffect(() => {
    const controller = new AbortController();
    setPreview(undefined);
    setPreviewError(undefined);
    onPreview(undefined);
    fetchSharingSelection(locationFilter(value), controller.signal)
      .then((ids) => {
        if (!controller.signal.aborted) {
          setPreview(ids);
          onPreview(ids);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setPreviewError(
            cause instanceof Error ? cause.message : String(cause),
          );
      });
    return () => controller.abort();
  }, [value, onPreview, attempt]);
  useEffect(() => {
    if (!inventory || !onSummary) return;
    const names = [
      ...value.floorIds.map(
        (id) =>
          inventory.options.find((o) => o.kind === "floor" && o.id === id)
            ?.name ?? id,
      ),
      ...value.areaIds.map(
        (id) =>
          inventory.options.find((o) => o.kind === "room" && o.id === id)
            ?.name ?? id,
      ),
    ];
    onSummary(
      t("locationSharing.summary", {
        locations: names.join(", ") || t("deviceWorkspace.plan.none"),
        devices: value.excludedDeviceIds.length,
        entities: value.excludedEntityIds.length,
        extras: t(
          value.includeDiagnosticEntities
            ? "deviceWorkspace.yes"
            : "deviceWorkspace.no",
        ),
      }),
    );
  }, [inventory, value, onSummary, t]);
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button onClick={() => setAttempt((n) => n + 1)}>
            {t("modern.retry")}
          </Button>
        }
      >
        {error}
      </Alert>
    );
  if (!inventory) return <CircularProgress aria-label={t("common.loading")} />;
  const selected: LocationOption[] = [
    ...value.floorIds.map(
      (id) =>
        inventory.options.find((o) => o.id === id && o.kind === "floor") ?? {
          id,
          name: id,
          kind: "floor" as const,
          missing: true,
        },
    ),
    ...value.areaIds.map(
      (id) =>
        inventory.options.find((o) => o.id === id && o.kind === "room") ?? {
          id,
          name: id,
          kind: "room" as const,
          missing: true,
        },
    ),
  ];
  const options = [...inventory.options, ...selected.filter((o) => o.missing)];
  const devices = groupHomeDevices(inventory.entities).filter((group) =>
    group.id.startsWith("device:"),
  );
  const deviceOptions = [
    ...devices.map((group) => ({ id: group.id.slice(7), name: group.name })),
    ...value.excludedDeviceIds
      .filter((id) => !devices.some((group) => group.id === `device:${id}`))
      .map((id) => ({ id, name: id })),
  ];
  const entityOptions = [
    ...inventory.entities.map((entity) => ({
      id: entity.entity_id,
      name: entity.friendly_name || entity.entity_id,
    })),
    ...value.excludedEntityIds
      .filter(
        (id) => !inventory.entities.some((entity) => entity.entity_id === id),
      )
      .map((id) => ({ id, name: id })),
  ];
  return (
    <Stack spacing={2}>
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={options}
        value={selected}
        disabled={disabled}
        groupBy={(option) => t(`locationSharing.${option.kind}`)}
        isOptionEqualToValue={(a, b) => a.id === b.id && a.kind === b.kind}
        getOptionLabel={(option) => option.name}
        onChange={(_, items) =>
          onChange({
            ...value,
            areaIds: items.filter((o) => o.kind === "room").map((o) => o.id),
            floorIds: items.filter((o) => o.kind === "floor").map((o) => o.id),
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={t("locationSharing.locations")}
            helperText={t("locationSharing.locationsHint")}
          />
        )}
      />
      {selected.some((o) => o.missing) && (
        <Alert severity="warning">{t("locationSharing.missing")}</Alert>
      )}
      <Alert severity="info">{t("locationSharing.deviceRule")}</Alert>
      <Box component="details">
        <Typography component="summary" sx={{ cursor: "pointer", py: 1 }}>
          {t("locationSharing.customize", {
            count:
              value.excludedDeviceIds.length + value.excludedEntityIds.length,
          })}
        </Typography>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                disabled={disabled}
                checked={value.includeDiagnosticEntities ?? false}
                onChange={(_, checked) =>
                  onChange({ ...value, includeDiagnosticEntities: checked })
                }
              />
            }
            label={t("locationSharing.diagnostics")}
          />
          <Typography variant="caption" color="text.secondary">
            {t("locationSharing.eligibility")}
          </Typography>
          <Autocomplete
            multiple
            disabled={disabled}
            options={deviceOptions}
            value={deviceOptions.filter((o) =>
              value.excludedDeviceIds.includes(o.id),
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            getOptionLabel={(o) => `${o.name} (${o.id})`}
            onChange={(_, items) =>
              onChange({ ...value, excludedDeviceIds: items.map((o) => o.id) })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("locationSharing.excludeDevices")}
                helperText={t("locationSharing.excludeDevicesHint")}
              />
            )}
          />
          <Autocomplete
            multiple
            disabled={disabled}
            options={entityOptions}
            value={entityOptions.filter((o) =>
              value.excludedEntityIds.includes(o.id),
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            getOptionLabel={(o) => `${o.name} (${o.id})`}
            onChange={(_, items) =>
              onChange({ ...value, excludedEntityIds: items.map((o) => o.id) })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("locationSharing.excludeEntities")}
              />
            )}
          />
        </Stack>
      </Box>
      {previewError ? (
        <Alert
          severity="error"
          action={
            <Button onClick={() => setAttempt((n) => n + 1)}>
              {t("modern.retry")}
            </Button>
          }
        >
          {previewError}
        </Alert>
      ) : preview ? (
        <Typography role="status">
          {t("locationSharing.preview", { count: preview.length })}
        </Typography>
      ) : (
        <CircularProgress aria-label={t("locationSharing.loading")} />
      )}
      <Typography variant="caption" color="text.secondary">
        {t("locationSharing.previewHint")}
      </Typography>
      <Alert severity="warning">{t("locationSharing.automaticWarning")}</Alert>
      <Button
        component="a"
        href="https://github.com/AdamDrewsTR/home-assistant-matter-hub-modern/blob/main/docs-site/docs/getting-started/sharing-devices.md"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ alignSelf: "flex-start" }}
      >
        {t("locationSharing.help")}
      </Button>
    </Stack>
  );
}
