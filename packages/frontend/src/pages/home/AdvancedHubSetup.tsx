import {
  type BridgeConfig,
  type BridgeTemplate,
  bridgeTemplates,
} from "@home-assistant-matter-hub/common";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { BridgeConfigEditor } from "../../components/bridge/BridgeConfigEditor.tsx";
import { BridgeTemplateSelector } from "../../components/bridge/BridgeTemplateSelector.tsx";
import { useCreateBridge, useUsedPorts } from "../../hooks/data/bridges.ts";

export function AdvancedHubSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateBridge();
  const usedPorts = useUsedPorts();
  const [template, setTemplate] = useState<BridgeTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  let port = 5540;
  while (usedPorts?.[port]) port++;
  const config: BridgeConfig = {
    name: template?.name ?? t("modern.defaultName"),
    port,
    filter: template?.filter ?? { include: [], exclude: [] },
    featureFlags: template?.featureFlags ?? {},
    icon: template?.icon,
  };
  async function save(draft: BridgeConfig) {
    if (saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const bridge = await create(draft);
      navigate(`/?hub=${encodeURIComponent(bridge.id)}&view=pair`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSaving(false);
    }
  }
  return (
    <Stack spacing={4}>
      <Box>
        <Button
          component={Link}
          to="/setup"
          startIcon={<ArrowBack />}
          sx={{ mb: 2 }}
        >
          {t("modern.backHome")}
        </Button>
        <Typography variant="overline" color="primary" display="block">
          {t("modern.setupEyebrow")}
        </Typography>
        <Typography variant="h1" sx={{ mt: 1 }}>
          {t("modern.advancedSetup")}
        </Typography>
      </Box>
      <Alert severity="warning">{t("workspace.advancedCreateWarning")}</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      <BridgeTemplateSelector
        selectedTemplate={template?.id}
        onSelect={(value) =>
          setTemplate(
            value
              ? (bridgeTemplates.find((item) => item.id === value.id) ?? null)
              : null,
          )
        }
      />
      <Box
        component="fieldset"
        disabled={saving}
        sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}
      >
        <BridgeConfigEditor
          key={`${template?.id ?? "custom"}/${revision}`}
          bridge={config}
          usedPorts={usedPorts ?? {}}
          onSave={save}
          onCancel={() => setRevision((value) => value + 1)}
        />
      </Box>
    </Stack>
  );
}
