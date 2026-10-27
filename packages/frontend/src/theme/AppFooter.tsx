import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { FloatingLanguageSwitcher } from "../components/misc/FloatingLanguageSwitcher.tsx";
import { navigation } from "../routes.tsx";

export const AppFooter = () => {
  const { t } = useTranslation();

  const links: { name: string; url: string }[] = [
    {
      name: t("footer.github"),
      url: navigation.githubRepository,
    },
    {
      name: t("footer.documentation"),
      url: navigation.documentation,
    },
    {
      name: t("footer.support"),
      url: navigation.support,
    },
  ];
  return (
    <Container sx={{ mt: 5, mb: 4 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        textAlign="center"
        display="block"
        data-testid="workspace-build"
      >
        Matter Hub Modern · {__APP_VERSION__} · {__APP_REVISION__}
      </Typography>
      <Divider sx={{ mt: 4, mb: 4 }} />
      <Grid container spacing={2} justifyContent="center">
        {links.map((link, idx) => (
          <Grid size={{ xs: 12, sm: "auto" }} key={idx.toString()}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              component={Link}
              href={link.url}
              target="_blank"
            >
              {link.name}
            </Button>
          </Grid>
        ))}
        <Grid size="auto">
          <FloatingLanguageSwitcher inline />
        </Grid>
      </Grid>
    </Container>
  );
};
