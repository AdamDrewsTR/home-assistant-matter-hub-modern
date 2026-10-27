import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#136a54",
          light: "#3a967b",
          dark: "#0c4d3e",
        },
        secondary: {
          main: "#4569a8",
          light: "#7596d7",
          dark: "#304c7d",
        },
        warning: {
          main: "#a34b00",
          light: "#c5722f",
          dark: "#743600",
          contrastText: "#ffffff",
        },
        background: {
          default: "#f3f6f9",
          paper: "#ffffff",
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#9df3d0",
          light: "#c5ffe7",
          dark: "#67c8a4",
          contrastText: "#102d25",
        },
        secondary: {
          main: "#a2bfff",
          light: "#cedcff",
          dark: "#7596d7",
        },
        background: {
          default: "#0b1018",
          paper: "#121b27",
        },
        text: { primary: "#edf2f8", secondary: "#9aaac0" },
        divider: "#253142",
      },
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: "clamp(2rem, 4vw, 3.2rem)",
      fontWeight: 600,
      letterSpacing: "-0.045em",
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 500,
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 500,
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 500,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 500,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiAutocomplete: {
      styleOverrides: {
        root: {
          minWidth: 0,
          maxWidth: "100%",
        },
        inputRoot: { minWidth: 0 },
        tag: { maxWidth: "calc(100% - 6px)" },
        option: { overflowWrap: "anywhere", minWidth: 0 },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { minWidth: 0, overflowWrap: "anywhere" },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { overflowWrap: "anywhere" },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { flexWrap: "wrap" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          boxShadow: "none",
          border: "1px solid",
          borderColor: "var(--mui-palette-divider)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          boxShadow: "none",
          padding: "10px 18px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "var(--mui-palette-background-default)",
          color: "var(--mui-palette-text-primary)",
          boxShadow: "none",
          borderBottom: "1px solid var(--mui-palette-divider)",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            "radial-gradient(ellipse at 85% 0, rgba(117,150,215,0.1), transparent 45rem)",
        },
        "*:focus-visible": {
          outline: "2px solid var(--mui-palette-primary-main)",
          outlineOffset: 3,
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animation: "none !important",
            transition: "none !important",
          },
        },
      },
    },
  },
});
