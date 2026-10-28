import Container from "@mui/material/Container";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { createRoot } from "react-dom/client";
import "../../src/i18n/index.ts";
import { EntityPicker } from "../../src/pages/home/EntityPicker.tsx";
import { appTheme } from "../../src/theme/theme.ts";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={appTheme}>
    <CssBaseline />
    <Container maxWidth="xl">
      <EntityPicker selected={[]} onChange={() => {}} />
    </Container>
  </ThemeProvider>,
);
