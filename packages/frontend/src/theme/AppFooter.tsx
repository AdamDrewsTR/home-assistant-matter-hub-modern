import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
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
    <Container sx={{ mt: { xs: 4, sm: 5 }, mb: { xs: 3, sm: 4 } }}>
      <Divider sx={{ mb: { xs: 2, sm: 3 } }} />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        columnGap={{ xs: 2, sm: 3 }}
        rowGap={1}
      >
        {links.map((link) => (
          <Link
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener"
            variant="body2"
            underline="hover"
            sx={{ py: 1 }}
          >
            {link.name}
          </Link>
        ))}
        <FloatingLanguageSwitcher inline />
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        textAlign="center"
        display="block"
        sx={{ mt: 1 }}
        data-testid="workspace-build"
      >
        Matter Hub Modern · {__APP_VERSION__} · {__APP_REVISION__}
      </Typography>
    </Container>
  );
};
