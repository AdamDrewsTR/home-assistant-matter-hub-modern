import type { EntityMappingConfig } from "@home-assistant-matter-hub/common";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createBackupSnapshot } from "../../api/backup.ts";

export function mappingChanges(
  before: EntityMappingConfig,
  after: EntityMappingConfig,
) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(
    (key) => {
      const previous = before[key as keyof EntityMappingConfig];
      const next = after[key as keyof EntityMappingConfig];
      return JSON.stringify(previous) === JSON.stringify(next)
        ? []
        : [
            {
              key,
              before: JSON.stringify(previous) ?? "-",
              after: JSON.stringify(next) ?? "-",
            },
          ];
    },
  );
}

export function selectionChanges(
  before: readonly string[],
  after: readonly string[],
) {
  return {
    added: after.filter((id) => !before.includes(id)),
    removed: before.filter((id) => !after.includes(id)),
  };
}
export function ChangePlanContent({
  before,
  after,
  snapshot,
  onSnapshotChange,
  warning,
}: {
  before: string[];
  after: string[];
  snapshot: boolean;
  onSnapshotChange: (value: boolean) => void;
  warning?: string;
}) {
  const { t } = useTranslation();
  const changes = selectionChanges(before, after);
  return (
    <Stack spacing={2}>
      {(["added", "removed"] as const).map((kind) => (
        <Box key={kind}>
          <Typography fontWeight={600}>
            {t(`deviceWorkspace.plan.${kind}`)}
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {changes[kind].length ? (
              changes[kind].map((id) => (
                <Chip
                  key={id}
                  size="small"
                  label={id}
                  sx={{ maxWidth: "100%" }}
                />
              ))
            ) : (
              <Typography color="text.secondary">
                {t("deviceWorkspace.plan.none")}
              </Typography>
            )}
          </Stack>
        </Box>
      ))}
      <Alert severity="warning">
        {warning ?? t("deviceWorkspace.plan.warning")}
      </Alert>
      <FormControlLabel
        control={
          <Checkbox
            checked={snapshot}
            onChange={(_, checked) => onSnapshotChange(checked)}
          />
        }
        label={t("deviceWorkspace.plan.snapshot")}
      />
      <Typography variant="caption" color="text.secondary">
        {t("deviceWorkspace.plan.snapshotNote")}
      </Typography>
    </Stack>
  );
}
export function ChangePlanDialog({
  open,
  before,
  after,
  onApply,
  onClose,
  onBusyChange,
  notice,
}: {
  open: boolean;
  before: string[];
  after: string[];
  onApply: () => Promise<void>;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
  notice?: string;
}) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState(false);
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{t("deviceWorkspace.plan.title")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box
            component="fieldset"
            disabled={saving}
            sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}
          >
            <ChangePlanContent
              before={before}
              after={after}
              snapshot={snapshot}
              onSnapshotChange={setSnapshot}
              warning={notice}
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
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          disabled={saving || !approved}
          onClick={async () => {
            setSaving(true);
            onBusyChange?.(true);
            setError(undefined);
            try {
              if (snapshot) {
                await createBackupSnapshot();
                setSnapshot(false);
              }
              await onApply();
              onClose();
            } catch (cause) {
              setError(
                `${cause && typeof cause === "object" && "message" in cause ? String(cause.message) : String(cause)} ${t("deviceWorkspace.plan.failed")}`,
              );
            } finally {
              setSaving(false);
              onBusyChange?.(false);
            }
          }}
        >
          {t(saving ? "modern.saving" : "modern.applyChanges")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
