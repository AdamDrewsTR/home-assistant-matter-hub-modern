import {
  type BridgeConfig,
  type BridgeIconType,
  bridgeConfigSchema,
} from "@home-assistant-matter-hub/common";
import { LibraryBooks, TextFields } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { navigation } from "../../routes.tsx";
import { FormEditor } from "../misc/editors/FormEditor";
import { JsonEditor } from "../misc/editors/JsonEditor";
import type { ValidationError } from "../misc/editors/validation-error.ts";
import { BridgeIconUpload } from "./BridgeIconUpload.tsx";
import { FilterPreview } from "./FilterPreview.tsx";
import { BridgeObjectFieldTemplate } from "./rjsf/BridgeObjectFieldTemplate.tsx";
import { CompactArrayFieldTemplate } from "./rjsf/CompactArrayFieldTemplate.tsx";
import { EntityFilterRuleField } from "./rjsf/EntityFilterRuleField.tsx";
import { FeatureFlagsField } from "./rjsf/FeatureFlagsField.tsx";

enum BridgeEditorMode {
  JSON_EDITOR = "JSON_EDITOR",
  FIELDS_EDITOR = "FIELDS_EDITOR",
}

export interface BridgeConfigEditorProps {
  bridgeId?: string;
  bridge: BridgeConfig;
  usedPorts: Record<number, string>;
  onSave: (config: BridgeConfig) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onDraftChange?: (config: BridgeConfig) => void;
}

export const BridgeConfigEditor = (props: BridgeConfigEditorProps) => {
  const { t } = useTranslation();
  const [editorMode, setEditorMode] = useState<BridgeEditorMode>(
    BridgeEditorMode.FIELDS_EDITOR,
  );
  const toggleEditor = () => {
    setEditorMode(
      editorMode === BridgeEditorMode.FIELDS_EDITOR
        ? BridgeEditorMode.JSON_EDITOR
        : BridgeEditorMode.FIELDS_EDITOR,
    );
  };

  const [config, setConfig] = useState<object | undefined>(props.bridge);
  const [isValid, setIsValid] = useState<boolean>(true);

  const validatePort = useCallback(
    (value: object | undefined): ValidationError[] => {
      const config = value as Partial<BridgeConfig> | undefined;
      if (!config?.port) {
        return [];
      }
      const usedBy = props.usedPorts[config.port];
      if (usedBy !== undefined && usedBy !== props.bridgeId) {
        return [
          {
            instancePath: "/port",
            message: `Port is already used by bridge with id ${usedBy}`,
          },
        ];
      }
      return [];
    },
    [props.bridgeId, props.usedPorts],
  );

  const onChange = (
    data: object | undefined,
    isValid: boolean,
    initialDefaults = false,
  ) => {
    // Preserve the icon field when FormEditor/JsonEditor updates
    // since icon is managed separately by BridgeIconUpload
    const prevIcon = (prev: object | undefined) => (prev as BridgeConfig)?.icon;
    const icon = prevIcon(config);
    const next = icon != null ? { ...data, icon } : { ...data };
    setConfig(next);
    if (!initialDefaults) props.onDraftChange?.(next as BridgeConfig);
    setIsValid(isValid);
  };

  const handleIconChange = (icon: BridgeIconType | undefined) => {
    const { icon: _, ...rest } = (config ?? {}) as BridgeConfig;
    const next = icon != null ? { ...rest, icon } : rest;
    setConfig(next);
    props.onDraftChange?.(next);
  };

  const warnings = useMemo(() => {
    const cfg = config as Partial<BridgeConfig> | undefined;
    const flags = cfg?.featureFlags;
    const result: { severity: "warning" | "error"; message: string }[] = [];

    if (flags?.serverMode) {
      result.push({
        severity: "warning",
        message:
          "Server Mode is enabled. The node carries up to 10 devices; the " +
          "first entity is the primary and drives the node name and type. " +
          "More than one device is experimental.",
      });
    }

    if (flags?.serverMode && flags?.vacuumOnOff === false) {
      result.push({
        severity: "warning",
        message:
          "Server Mode with Vacuum OnOff disabled: Alexa REQUIRES the OnOff cluster " +
          "(PowerController) for robotic vacuums. Without it, the vacuum commissions " +
          "but never appears in Alexa. Only disable this for Apple Home.",
      });
    }

    if (!flags?.serverMode && flags?.vacuumOnOff) {
      result.push({
        severity: "warning",
        message:
          "Vacuum OnOff is enabled in bridge mode. This adds a non-standard cluster " +
          "to the RVC device type which may cause issues with Apple Home and Google Home.",
      });
    }

    if (flags?.autoForceSync && flags?.autoComposedDevices) {
      result.push({
        severity: "warning",
        message:
          "Auto Force Sync with Auto Composed Devices increases network traffic. " +
          "Composed devices have more clusters, so each sync cycle sends more data.",
      });
    }

    return result;
  }, [config]);

  const saveAction = async () => {
    if (!isValid) {
      return;
    }
    await props.onSave(config as BridgeConfig);
  };

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        <Link href={navigation.faq.bridgeConfig} target="_blank">
          {t("workspace.configReference")}
        </Link>{" "}
        {t("workspace.configHelp")}
      </Typography>

      {warnings.map((w) => (
        <Alert key={w.message} severity={w.severity} variant="outlined">
          {w.message}
        </Alert>
      ))}

      <Stack spacing={2}>
        <Box display="flex" justifyContent={"flex-end"}>
          <Button
            onClick={() => toggleEditor()}
            title={
              editorMode === BridgeEditorMode.FIELDS_EDITOR
                ? t("bridge.jsonEditor")
                : t("bridge.formEditor")
            }
          >
            {editorMode === BridgeEditorMode.FIELDS_EDITOR ? (
              <TextFields />
            ) : (
              <LibraryBooks />
            )}
            {t(
              editorMode === BridgeEditorMode.FIELDS_EDITOR
                ? "bridge.jsonEditor"
                : "bridge.formEditor",
            )}
          </Button>
        </Box>

        {editorMode === BridgeEditorMode.FIELDS_EDITOR && (
          <FormEditor
            value={config ?? {}}
            onChange={onChange}
            schema={bridgeConfigSchema}
            uiSchema={{
              "ui:submitButtonOptions": { norender: true },
              icon: { "ui:widget": "hidden" },
              featureFlags: { "ui:field": "featureFlags" },
              filter: {
                include: {
                  "ui:options": {
                    ArrayFieldTemplate: CompactArrayFieldTemplate,
                  },
                  items: { "ui:field": "entityFilterRule" },
                },
                exclude: {
                  "ui:options": {
                    ArrayFieldTemplate: CompactArrayFieldTemplate,
                  },
                  items: { "ui:field": "entityFilterRule" },
                },
              },
            }}
            customValidate={validatePort}
            templates={{ ObjectFieldTemplate: BridgeObjectFieldTemplate }}
            fields={{
              featureFlags: FeatureFlagsField,
              entityFilterRule: EntityFilterRuleField,
            }}
          />
        )}

        {editorMode === BridgeEditorMode.JSON_EDITOR && (
          <JsonEditor
            value={config ?? {}}
            onChange={onChange}
            schema={bridgeConfigSchema}
            customValidate={validatePort}
          />
        )}

        {(config as BridgeConfig)?.filter && (
          <FilterPreview filter={(config as BridgeConfig).filter} />
        )}

        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              {t("bridge.iconLabel")}
            </Typography>
            <BridgeIconUpload
              bridgeId={props.bridgeId}
              selectedIcon={(config as BridgeConfig)?.icon}
              onIconChange={handleIconChange}
            />
          </CardContent>
        </Card>

        <Grid container>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={props.onCancel}
            >
              {t("common.cancel")}
            </Button>
          </Grid>
          <Grid
            size={{ xs: 0, sm: 4, md: 6 }}
            sx={{ display: { xs: "none", sm: "block" } }}
          />
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              disabled={!isValid}
              onClick={saveAction}
            >
              {t("common.save")}
            </Button>
          </Grid>
        </Grid>
      </Stack>
    </>
  );
};
