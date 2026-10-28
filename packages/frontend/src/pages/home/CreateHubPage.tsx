import {
  type ControllerType,
  controllerProfiles,
} from "@home-assistant-matter-hub/common";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCreateBridge } from "../../hooks/data/bridges.ts";
import { navigation } from "../../routes.tsx";
import { EntityPicker } from "./EntityPicker.tsx";
import { LocationSharing } from "./LocationSharing.tsx";
import { SharingMode } from "./SharingMode.tsx";
import {
  emptyLocationSharing,
  locationFilter,
  selectionFilter,
} from "./sharing.ts";

const AdvancedHubSetup = lazy(() =>
  import("./AdvancedHubSetup.tsx").then((module) => ({
    default: module.AdvancedHubSetup,
  })),
);

export function CreateHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const createBridge = useCreateBridge();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(t("modern.defaultName"));
  const [controller, setController] = useState<ControllerType>("alexa");
  const [selected, setSelected] = useState<string[]>([]);
  const [follow, setFollow] = useState(false);
  const [locationSharing, setLocationSharing] = useState(emptyLocationSharing);
  const [locationPreview, setLocationPreview] = useState<string[]>();
  const [locationSummary, setLocationSummary] = useState("");
  const selectionReady = follow
    ? locationPreview !== undefined &&
      !!(locationSharing.areaIds.length || locationSharing.floorIds.length)
    : !!selected.length;
  const count = follow ? (locationPreview?.length ?? 0) : selected.length;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const profile = controllerProfiles.find((item) => item.id === controller)!;

  async function create() {
    if (saving || !name.trim() || !selectionReady) return;
    setSaving(true);
    setError(undefined);
    try {
      const bridge = await createBridge({
        name: name.trim(),
        filter: follow
          ? locationFilter(locationSharing)
          : selectionFilter(selected),
        featureFlags: { ...profile.featureFlags },
      });
      navigate(`/?hub=${encodeURIComponent(bridge.id)}&view=pair`, {
        replace: true,
        state: { focusWorkspace: true },
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("modern.createFailed"),
      );
      setSaving(false);
    }
  }

  if (params.get("advanced") === "true")
    return (
      <Suspense fallback={t("common.loading")}>
        <AdvancedHubSetup />
      </Suspense>
    );
  return (
    <Stack spacing={4}>
      <Box>
        <Button
          component={Link}
          to="/"
          replace
          startIcon={<ArrowBack />}
          sx={{ mb: 2 }}
        >
          {t("modern.backHome")}
        </Button>
        <Typography variant="overline" color="primary" display="block">
          {t("modern.setupEyebrow")}
        </Typography>
        <Typography variant="h1" sx={{ mt: 1 }}>
          {t("modern.setupTitle")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: { xs: 1, sm: 2 } }}>
          {t("modern.setupDescription")}
        </Typography>
      </Box>
      <Stepper activeStep={step} alternativeLabel>
        {[
          "modern.chooseAssistant",
          "modern.chooseDevices",
          "modern.review",
        ].map((key) => (
          <Step key={key}>
            <StepLabel>{t(key)}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {error && <Alert severity="error">{error}</Alert>}
      {step === 0 && (
        <Stack spacing={3}>
          <TextField
            label={t("modern.hubName")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            slotProps={{ htmlInput: { maxLength: 32 } }}
          />
          <Box
            role="group"
            aria-label={t("modern.chooseAssistant")}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              gap: 2,
            }}
          >
            {controllerProfiles.map((item) => (
              <Card
                key={item.id}
                variant="outlined"
                sx={{
                  borderColor:
                    controller === item.id ? "primary.main" : "divider",
                }}
              >
                <CardActionArea
                  onClick={() => setController(item.id)}
                  aria-pressed={controller === item.id}
                  sx={{ p: { xs: 2, sm: 3 } }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CheckCircleOutline
                      color={controller === item.id ? "primary" : "disabled"}
                    />
                    <Box>
                      <Typography fontWeight={600}>{item.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(`modern.controller.${item.id}`)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardActionArea>
              </Card>
            ))}
          </Box>
          <Alert severity="info">{t("modern.oneHubHint")}</Alert>
        </Stack>
      )}
      {step === 1 && (
        <Stack spacing={3}>
          <SharingMode follow={follow} onChange={setFollow} />
          {follow ? (
            <LocationSharing
              value={locationSharing}
              onChange={setLocationSharing}
              onPreview={setLocationPreview}
              onSummary={setLocationSummary}
            />
          ) : (
            <EntityPicker selected={selected} onChange={setSelected} />
          )}
        </Stack>
      )}
      {step === 2 && (
        <Card variant="outlined" sx={{ p: { xs: 2, sm: 3, md: 5 } }}>
          <Typography variant="h2">{name}</Typography>
          <Typography color="primary" sx={{ mt: 2, mb: 2 }}>
            {t("modern.reviewSummary", {
              count,
              controller: profile.name,
            })}
          </Typography>
          <Typography color="text.secondary">
            {t("modern.reviewDescription")}
          </Typography>
          <Alert severity="info" sx={{ mt: 3 }}>
            {t("modern.networkNote")}
          </Alert>
          {follow && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {locationSummary} {t("locationSharing.reviewWarning")}
            </Alert>
          )}
        </Card>
      )}
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        flexWrap="wrap"
        useFlexGap
        sx={{
          position: "sticky",
          bottom: { xs: 0, sm: 16 },
          bgcolor: "background.paper",
          mx: { xs: -2, sm: 0 },
          px: 2,
          pt: { xs: 1.5, sm: 2 },
          pb: { xs: "calc(12px + env(safe-area-inset-bottom))", sm: 2 },
          border: "1px solid",
          borderColor: "divider",
          borderWidth: { xs: "1px 0 0", sm: 1 },
          borderRadius: { xs: 0, sm: 3 },
          rowGap: 1,
          zIndex: 2,
        }}
      >
        <Button
          disabled={saving || step === 0}
          sx={{ flexGrow: { xs: 1, sm: 0 } }}
          onClick={() => setStep(step - 1)}
        >
          {t("common.back")}
        </Button>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: step === 0 ? { xs: "none", sm: "block" } : undefined,
            flex: { xs: "1 0 100%", sm: 1 },
            order: { xs: -1, sm: 0 },
          }}
        >
          {t("modern.selectedCount", { count })}
        </Typography>
        <Button
          variant="contained"
          sx={{ flexGrow: { xs: 1, sm: 0 } }}
          disabled={saving || !name.trim() || (step > 0 && !selectionReady)}
          endIcon={<ArrowForward />}
          onClick={() => (step === 2 ? create() : setStep(step + 1))}
        >
          {saving
            ? t("modern.creating")
            : step === 2
              ? t("modern.createAndPair")
              : t("common.next")}
        </Button>
      </Stack>
      <Button
        component={Link}
        to={navigation.advancedSetup}
        replace
        startIcon={<SettingsOutlined />}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("modern.advancedSetup")}
      </Button>
    </Stack>
  );
}
