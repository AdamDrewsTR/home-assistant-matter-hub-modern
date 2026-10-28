import {
  type BridgeDataWithMetadata,
  type EntityMappingConfig,
  matterDeviceTypeLabels,
} from "@home-assistant-matter-hub/common";
import DevicesOutlined from "@mui/icons-material/DevicesOutlined";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import LightbulbOutlined from "@mui/icons-material/LightbulbOutlined";
import Search from "@mui/icons-material/Search";
import SensorsOutlined from "@mui/icons-material/SensorsOutlined";
import ToggleOnOutlined from "@mui/icons-material/ToggleOnOutlined";
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
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchEntityMappings } from "../../api/entity-mappings.ts";
import {
  fetchHomeEntities,
  type HomeEntity,
} from "../../api/home-inventory.ts";
import { fetchAreas, type HomeAssistantArea } from "../../api/labels.ts";
import { capabilityType } from "./capabilities.ts";
import { groupHomeDevices } from "./device-groups.ts";

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
  const [showAll, setShowAll] = useState(false);
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry intentionally reloads the same inventory.
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

  const selectedSet = new Set(selected);
  const entityType = (entity: HomeEntity) =>
    capabilityType(
      entity,
      mappings.find((mapping) => mapping.entityId === entity.entity_id),
    );
  const available = entities.filter(
    (entity) =>
      showAll ||
      selectedSet.has(entity.entity_id) ||
      (!entity.disabled && !entity.hidden && !entity.entity_category),
  );
  const groups = groupHomeDevices(available);
  const roomName = (id?: string) =>
    areas.find((item) => item.area_id === id)?.name || t("modern.unassigned");
  const query = search.trim().toLocaleLowerCase();
  const visibleGroups = groups
    .filter((group) => !area || (group.areaId || "unassigned") === area)
    .flatMap((group) => {
      const groupText =
        `${group.name} ${roomName(group.areaId)} ${group.manufacturer ?? ""} ${group.model ?? ""}`.toLocaleLowerCase();
      const matching = group.entities.filter(
        (entity) =>
          (!selectedOnly || selectedSet.has(entity.entity_id)) &&
          (!capability || entityType(entity) === capability) &&
          (!query ||
            `${groupText} ${entity.friendly_name ?? ""} ${entity.entity_id}`
              .toLocaleLowerCase()
              .includes(query)),
      );
      return matching.length ? [{ ...group, entities: matching }] : [];
    });
  const visible = visibleGroups.flatMap((group) => group.entities);
  const rooms = [...new Set(groups.map((group) => group.areaId))].sort(
    (a, b) =>
      a === undefined
        ? 1
        : b === undefined
          ? -1
          : roomName(a).localeCompare(roomName(b)),
  );
  const missing = selected.filter(
    (id) => !entities.some((entity) => entity.entity_id === id),
  );
  function toggle(ids: string[], checked: boolean) {
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  }
  async function configure(entity: HomeEntity) {
    if (!bridge) return;
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
      setEditError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setOpening(false);
    }
  }
  function stateLabel(entity: HomeEntity) {
    const unit = entity.attributes?.unit_of_measurement;
    return `${entity.friendly_name || entity.domain.replace(/_/g, " ")}: ${entity.state}${typeof unit === "string" ? ` ${unit}` : ""}`;
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
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "200px minmax(0, 1fr)",
          },
          gap: { xs: 2, md: 4 },
          alignItems: "start",
        }}
      >
        <Box
          component="nav"
          aria-label={t("homeBrowser.spaces")}
          sx={{ position: { md: "sticky" }, top: 16, minWidth: 0 }}
        >
          <Typography variant="overline" color="text.secondary">
            {t("homeBrowser.spaces")}
          </Typography>
          <Stack
            direction={{ xs: "row", md: "column" }}
            spacing={0.5}
            useFlexGap
            sx={{ flexWrap: { xs: "wrap", md: "nowrap" }, pb: 1 }}
          >
            <Button
              aria-pressed={!area}
              startIcon={<HomeOutlined />}
              variant={!area ? "contained" : "text"}
              onClick={() => setArea("")}
              sx={{
                justifyContent: "flex-start",
                maxWidth: "100%",
                minWidth: 0,
                overflowWrap: "anywhere",
              }}
            >
              {t("homeBrowser.wholeHome")}
            </Button>
            {rooms.map((id) => (
              <Button
                key={id ?? "unassigned"}
                aria-label={roomName(id)}
                aria-pressed={area === (id || "unassigned")}
                variant={area === (id || "unassigned") ? "contained" : "text"}
                onClick={() => setArea(id || "unassigned")}
                sx={{
                  justifyContent: "space-between",
                  gap: 1,
                  maxWidth: "100%",
                  minWidth: 0,
                  overflowWrap: "anywhere",
                }}
              >
                {roomName(id)}
                <Typography component="span" variant="caption">
                  {groups.filter((group) => group.areaId === id).length}
                </Typography>
              </Button>
            ))}
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", md: "block" }, mt: 2 }}
          >
            {t("homeBrowser.roomNote")}
          </Typography>
        </Box>
        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          <Box>
            <Typography variant="h2" sx={{ overflowWrap: "anywhere" }}>
              {area
                ? roomName(area === "unassigned" ? undefined : area)
                : t("homeBrowser.wholeHome")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {t("homeBrowser.instructions")}
            </Typography>
          </Box>
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
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mr: "auto", flex: { xs: "1 0 100%", sm: "0 1 auto" } }}
            >
              {t("homeBrowser.count", {
                devices: visibleGroups.length,
                entities: visible.length,
                selected: selected.length,
              })}
            </Typography>
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
          <Box component="details">
            <Box
              component="summary"
              sx={{ cursor: "pointer", color: "text.secondary" }}
            >
              {t("homeBrowser.filters")}
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              gap={2}
              sx={{ mt: 2 }}
              alignItems={{ sm: "center" }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedOnly}
                    onChange={(_, checked) => setSelectedOnly(checked)}
                  />
                }
                label={t("modern.selectedOnly")}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showAll}
                    onChange={(_, checked) => setShowAll(checked)}
                  />
                }
                label={t("homeBrowser.showAll")}
              />
              <TextField
                select
                size="small"
                label={t("deviceWorkspace.capability")}
                value={capability}
                onChange={(event) => setCapability(event.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">
                  {t("deviceWorkspace.allCapabilities")}
                </MenuItem>
                {[
                  ...new Set(
                    entities
                      .map(entityType)
                      .filter((type) => type !== undefined),
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
          </Box>
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
            <Typography color="text.secondary" sx={{ py: 4 }}>
              {t("modern.noResults")}
            </Typography>
          )}
          {[...new Set(visibleGroups.map((group) => group.areaId))]
            .sort((a, b) => roomName(a).localeCompare(roomName(b)))
            .map((areaId) => (
              <Box key={areaId || "unassigned"}>
                {!area && (
                  <Typography
                    variant="h3"
                    sx={{ mb: 2, overflowWrap: "anywhere" }}
                  >
                    {roomName(areaId)}
                  </Typography>
                )}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      lg: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 2,
                    alignItems: "start",
                  }}
                >
                  {visibleGroups
                    .filter((group) => group.areaId === areaId)
                    .map((group) => {
                      const count = group.entities.filter((entity) =>
                        selectedSet.has(entity.entity_id),
                      ).length;
                      const first = group.entities[0];
                      const Icon =
                        first.domain === "light"
                          ? LightbulbOutlined
                          : first.domain === "switch"
                            ? ToggleOnOutlined
                            : first.domain === "sensor" ||
                                first.domain === "binary_sensor"
                              ? SensorsOutlined
                              : DevicesOutlined;
                      return (
                        <Card
                          key={group.id}
                          variant="outlined"
                          sx={{
                            p: { xs: 2, sm: 2.5 },
                            borderColor: count ? "primary.main" : "divider",
                            bgcolor: count
                              ? "action.selected"
                              : "background.paper",
                            minWidth: 0,
                          }}
                        >
                          <Box
                            component="label"
                            sx={{
                              display: "flex",
                              gap: 1.5,
                              alignItems: "center",
                              cursor: disabled ? "default" : "pointer",
                            }}
                          >
                            <Box
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: "action.hover",
                                display: "flex",
                              }}
                            >
                              <Icon color={count ? "primary" : "action"} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                fontWeight={600}
                                sx={{ overflowWrap: "anywhere" }}
                              >
                                {group.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ overflowWrap: "anywhere" }}
                              >
                                {[group.manufacturer, group.model]
                                  .filter(Boolean)
                                  .join(" · ") || roomName(group.areaId)}
                              </Typography>
                            </Box>
                            <Checkbox
                              disabled={disabled}
                              checked={count === group.entities.length}
                              indeterminate={
                                count > 0 && count < group.entities.length
                              }
                              slotProps={{
                                input: {
                                  "aria-label": t("modern.selectDevice", {
                                    name: group.name,
                                  }),
                                },
                              }}
                              onChange={(_, checked) =>
                                toggle(
                                  group.entities.map(
                                    (entity) => entity.entity_id,
                                  ),
                                  checked,
                                )
                              }
                            />
                          </Box>
                          <Stack
                            direction="row"
                            gap={0.75}
                            flexWrap="wrap"
                            sx={{ mt: 2 }}
                          >
                            {group.entities.slice(0, 3).map((entity) => (
                              <Chip
                                key={entity.entity_id}
                                size="small"
                                variant="outlined"
                                label={stateLabel(entity)}
                                color={
                                  ["unknown", "unavailable"].includes(
                                    entity.state,
                                  )
                                    ? "warning"
                                    : "default"
                                }
                                sx={{ maxWidth: "100%" }}
                              />
                            ))}
                            {group.entities.length > 3 && (
                              <Chip
                                size="small"
                                label={`+${group.entities.length - 3}`}
                              />
                            )}
                          </Stack>
                          <Typography
                            variant="caption"
                            color={count ? "primary" : "text.secondary"}
                            sx={{ display: "block", my: 1.5 }}
                          >
                            {t("homeBrowser.deviceSelection", {
                              selected: count,
                              count: group.entities.length,
                            })}
                          </Typography>
                          <Box
                            component="details"
                            open={query ? true : undefined}
                          >
                            <Box
                              component="summary"
                              sx={{
                                cursor: "pointer",
                                fontSize: "0.875rem",
                                color: "text.secondary",
                              }}
                            >
                              {t("homeBrowser.entities", {
                                count: group.entities.length,
                              })}
                            </Box>
                            {group.entities.map((entity) => (
                              <Box
                                key={entity.entity_id}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  mt: 1,
                                  borderTop: "1px solid",
                                  borderColor: "divider",
                                  pt: 1,
                                }}
                              >
                                <Box
                                  component="label"
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  <Checkbox
                                    disabled={disabled}
                                    checked={selectedSet.has(entity.entity_id)}
                                    slotProps={{
                                      input: {
                                        "aria-label":
                                          entity.friendly_name ||
                                          entity.entity_id,
                                      },
                                    }}
                                    onChange={(_, checked) =>
                                      toggle([entity.entity_id], checked)
                                    }
                                  />
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                      variant="body2"
                                      sx={{ overflowWrap: "anywhere" }}
                                    >
                                      {entity.friendly_name || entity.entity_id}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        display: "block",
                                        overflowWrap: "anywhere",
                                      }}
                                    >
                                      {entity.entity_id}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="primary"
                                    >
                                      {entityType(entity)
                                        ? matterDeviceTypeLabels[
                                            entityType(entity)!
                                          ]
                                        : t(
                                            "deviceWorkspace.unclassifiedShort",
                                          )}
                                    </Typography>
                                  </Box>
                                </Box>
                                {bridge && (
                                  <Button
                                    size="small"
                                    disabled={disabled || opening}
                                    aria-label={t(
                                      "deviceWorkspace.configureNamed",
                                      {
                                        name:
                                          entity.friendly_name ||
                                          entity.entity_id,
                                      },
                                    )}
                                    onClick={() => void configure(entity)}
                                  >
                                    {t("deviceWorkspace.configure")}
                                  </Button>
                                )}
                              </Box>
                            ))}
                          </Box>
                        </Card>
                      );
                    })}
                </Box>
              </Box>
            ))}
          <Typography variant="caption" color="text.secondary">
            {t("homeBrowser.groupingNote")}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
