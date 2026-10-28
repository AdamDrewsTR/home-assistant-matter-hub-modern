import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

export function SharingMode({
  follow,
  onChange,
  disabled,
}: {
  follow: boolean;
  onChange: (follow: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <FormControl disabled={disabled}>
      <FormLabel id="sharing-mode-label">{t("locationSharing.mode")}</FormLabel>
      <RadioGroup
        aria-labelledby="sharing-mode-label"
        value={follow ? "locations" : "manual"}
        onChange={(event) => onChange(event.target.value === "locations")}
      >
        <FormControlLabel
          value="manual"
          control={<Radio />}
          label={t("locationSharing.manual")}
        />
        <FormControlLabel
          value="locations"
          control={<Radio />}
          label={t("locationSharing.follow")}
        />
      </RadioGroup>
      <Typography variant="body2" color="text.secondary">
        {t(
          follow ? "locationSharing.followHint" : "locationSharing.manualHint",
        )}
      </Typography>
    </FormControl>
  );
}
