import {
  type BridgeDataWithMetadata,
  type EntityMappingConfig,
  matterDeviceTypeLabels,
} from "@home-assistant-matter-hub/common";
import DevicesOutlined from "@mui/icons-material/DevicesOutlined";
import Search from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchEntityMappings } from "../../api/entity-mappings.ts";
import {
  fetchHomeEntities,
  type HomeEntity,
} from "../../api/home-inventory.ts";
import { fetchAreas, type HomeAssistantArea } from "../../api/labels.ts";
import { capabilityType } from "./capabilities.ts";

interface EntityPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  bridge?: BridgeDataWithMetadata;
  onEditorOpenChange?: (open: boolean) => void;
  onEditorBusyChange?: (busy: boolean) => void;
}
const DeviceEditor = lazy(() =>
  import("./DeviceEditor.tsx").then((module) => ({
    default: module.DeviceEditor,
  })),
);

export function EntityPicker({
  selected,
  onChange,
  disabled,
  bridge,
  onEditorOpenChange,
  onEditorBusyChange,
}: EntityPickerProps) {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<HomeEntity[]>([]);
  const [areas, setAreas] = useState<HomeAssistantArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [capability, setCapability] = useState("");
  const [editing, setEditing] = useState<{
    entity: HomeEntity;
    mapping?: EntityMappingConfig;
  }>();
  const [editError, setEditError] = useState<string>();
  const [opening, setOpening] = useState(false);
  const [mappings, setMappings] = useState<EntityMappingConfig[]>([]);
  const bridgeId = bridge?.id;
  useEffect(() => {
    onEditorOpenChange?.(!!editing);
  }, [editing, onEditorOpenChange]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry intentionally reloads the same inventory request.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(undefined);
    Promise.all([
      fetchHomeEntities(controller.signal),
      fetchAreas(),
      bridgeId
        ? fetchEntityMappings(bridgeId)
        : Promise.resolve({ mappings: [] }),
    ])
      .then(([nextEntities, nextAreas, nextMappings]) => {
        if (!active) return;
        setEntities(nextEntities);
        setAreas(nextAreas);
        setMappings(nextMappings.mappings);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, bridgeId]);
  const entityType = (entity: HomeEntity) =>
    capabilityType(
      entity,
      mappings.find((mapping) => mapping.entityId === entity.entity_id),
    );

  const selectedSet = new Set(selected);
  const visible = entities.filter((entity) => {
    if (
      (entity.disabled || entity.hidden || entity.entity_category) &&
      !selectedSet.has(entity.entity_id)
    )
      return false;
    if (area && (entity.area_id || "unassigned") !== area) return false;
    if (selectedOnly && !selectedSet.has(entity.entity_id)) return false;
    if (capability && entityType(entity) !== capability) return false;
    return `${entity.friendly_name ?? ""} ${entity.entity_id} ${entity.device_name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  const groups = useMemo(() => {
    const result = new Map<
      string,
      { name: string; room: string; entities: HomeEntity[] }
    >();
    for (const entity of visible) {
      const room =
        areas.find((item) => item.area_id === entity.area_id)?.name ??
        t("modern.unassigned");
      const key = `${entity.area_id ?? ""}/${entity.device_id || entity.domain}`;
      const group: { name: string; room: string; entities: HomeEntity[] } =
        result.get(key) ?? {
          name: entity.device_name || entity.domain.replace(/_/g, " "),
          room,
          entities: [],
        };
      group.entities.push(entity);
      result.set(key, group);
    }
    return [...result.entries()].sort(([, a], [, b]) =>
      `${a.room} ${a.name}`.localeCompare(`${b.room} ${b.name}`),
    );
  }, [visible, areas, t]);

  function toggle(ids: string[], checked: boolean) {
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  }

  if (loading)
    return (
      <Box role="status" sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress aria-label={t("common.loading")} />
      </Box>
    );
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button onClick={() => setAttempt((value) => value + 1)}>
            {t("modern.retry")}
          </Button>
        }
      >
        {error}
      </Alert>
    );

  const missing = selected.filter(
    (id) => !entities.some((entity) => entity.entity_id === id),
  );

  return (
    <Stack spacing={2.5}>
      {editError && <Alert severity="error">{editError}</Alert>}
      {editing && bridge && (
        <Suspense fallback={<CircularProgress />}>
          <DeviceEditor
            key={editing.entity.entity_id}
            entity={editing.entity}
            inventory={entities}
            mapping={editing.mapping}
            bridge={bridge}
            shared={selected.includes(editing.entity.entity_id)}
            onBusyChange={onEditorBusyChange}
            onSharedChange={(checked) =>
              toggle([editing.entity.entity_id], checked)
            }
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              setAttempt((value) => value + 1);
            }}
          />
        </Suspense>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          label={t("modern.search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label={t("modern.room")}
          value={area}
          onChange={(event) => setArea(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t("modern.allRooms")}</MenuItem>
          {areas.map((item) => (
            <MenuItem key={item.area_id} value={item.area_id}>
              {item.name}
            </MenuItem>
          ))}
          <MenuItem value="unassigned">{t("modern.unassigned")}</MenuItem>
        </TextField>
        <TextField
          select
          label={t("deviceWorkspace.capability")}
          value={capability}
          onChange={(event) => setCapability(event.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">{t("deviceWorkspace.allCapabilities")}</MenuItem>
          {[
            ...new Set(
              entities.map(entityType).filter((type) => type !== undefined),
            ),
          ]
            .sort()
            .map((type) => (
              <MenuItem key={type} value={type}>
                {matterDeviceTypeLabels[type]}
              </MenuItem>
            ))}
        </TextField>
      </Stack>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
          {t("modern.visibleCount", { count: visible.length })}
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={selectedOnly}
              onChange={(_, checked) => setSelectedOnly(checked)}
            />
          }
          label={t("modern.selectedOnly")}
        />
        <Button
          size="small"
          disabled={disabled || !visible.length}
          onClick={() =>
            toggle(
              visible.map((entity) => entity.entity_id),
              true,
            )
          }
        >
          {t("modern.selectVisible")}
        </Button>
        <Button
          size="small"
          disabled={disabled || !visible.length}
          onClick={() =>
            toggle(
              visible.map((entity) => entity.entity_id),
              false,
            )
          }
        >
          {t("modern.clearVisible")}
        </Button>
      </Stack>
      {missing.length > 0 && (
        <Alert severity="warning">
          {t("modern.missingSelected")}
          {missing.map((id) => (
            <Chip
              key={id}
              label={id}
              onDelete={disabled ? undefined : () => toggle([id], false)}
              sx={{ m: 0.5 }}
            />
          ))}
        </Alert>
      )}
      {!visible.length && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          {t("modern.noResults")}
        </Typography>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
          alignItems: "start",
        }}
      >
        {groups.map(([key, group]) => {
          const count = group.entities.filter((entity) =>
            selectedSet.has(entity.entity_id),
          ).length;
          return (
            <Card
              key={key}
              variant="outlined"
              sx={{ p: 2, borderColor: count ? "primary.main" : "divider" }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{ mb: 1 }}
              >
                <DevicesOutlined color="secondary" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    fontWeight={600}
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {group.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.room}
                  </Typography>
                </Box>
                <Checkbox
                  disabled={disabled}
                  checked={count === group.entities.length}
                  indeterminate={count > 0 && count < group.entities.length}
                  slotProps={{
                    input: {
                      "aria-label": t("modern.selectDevice", {
                        name: group.name,
                      }),
                    },
                  }}
                  onChange={(_, checked) =>
                    toggle(
                      group.entities.map((entity) => entity.entity_id),
                      checked,
                    )
                  }
                />
              </Stack>
              {group.entities.map((entity) => (
                <Box
                  component="div"
                  key={entity.entity_id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1,
                    cursor: disabled ? "default" : "pointer",
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box
                    component="label"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      flex: 1,
                      minWidth: 0,
                      cursor: "inherit",
                    }}
                  >
                    <Checkbox
                      disabled={disabled}
                      checked={selectedSet.has(entity.entity_id)}
                      slotProps={{
                        input: {
                          "aria-label":
                            entity.friendly_name || entity.entity_id,
                        },
                      }}
                      onChange={(_, checked) =>
                        toggle([entity.entity_id], checked)
                      }
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2">
                        {entity.friendly_name || entity.entity_id}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: "anywhere" }}
                      >
                        {entity.entity_id}
                      </Typography>
                      <Typography
                        variant="caption"
                        display="block"
                        color="primary"
                      >
                        {entityType(entity)
                          ? matterDeviceTypeLabels[entityType(entity)!]
                          : t("deviceWorkspace.unclassifiedShort")}
                      </Typography>
                    </Box>
                  </Box>
                  {bridge && (
                    <Button
                      size="small"
                      disabled={disabled || opening}
                      aria-label={t("deviceWorkspace.configureNamed", {
                        name: entity.friendly_name || entity.entity_id,
                      })}
                      onClick={async () => {
                        setOpening(true);
                        setEditError(undefined);
                        try {
                          const result = await fetchEntityMappings(bridge.id);
                          setEditing({
                            entity,
                            mapping: result.mappings.find(
                              (item) => item.entityId === entity.entity_id,
                            ),
                          });
                        } catch (cause) {
                          setEditError(
                            cause instanceof Error
                              ? cause.message
                              : String(cause),
                          );
                        } finally {
                          setOpening(false);
                        }
                      }}
                    >
                      {t("deviceWorkspace.configure")}
                    </Button>
                  )}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={entity.state}
                    sx={{ maxWidth: "30%" }}
                  />
                </Box>
              ))}
            </Card>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t("modern.compatibilityNote")} {t("deviceWorkspace.capabilityNote")}
      </Typography>
    </Stack>
  );
}
