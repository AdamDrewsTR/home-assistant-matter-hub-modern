import { createTheme } from "@mui/material/styles";

const phone = "@media (max-width:599.95px)";

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
      [phone]: { fontSize: "1.75rem", letterSpacing: "-0.03em" },
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 500,
      [phone]: { fontSize: "1.375rem", fontWeight: 600 },
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 500,
      [phone]: { fontSize: "1.125rem", fontWeight: 600 },
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 500,
      [phone]: { fontSize: "1.125rem" },
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 500,
      [phone]: { fontSize: "1.0625rem" },
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
    MuiMenuItem: {
      styleOverrides: {
        root: {
          whiteSpace: "normal",
          overflowWrap: "anywhere",
        },
      },
    },
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
    MuiDialog: {
      styleOverrides: {
        paperFullWidth: {
          [phone]: {
            margin: 0,
            width: "100%",
            maxWidth: "100%",
            height: "100%",
            maxHeight: "100%",
            borderRadius: 0,
          },
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          flexWrap: "wrap",
          [phone]: {
            borderTop: "1px solid var(--mui-palette-divider)",
            paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
          },
        },
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
    MuiAlert: {
      styleOverrides: {
        root: {
          [phone]: {
            flexWrap: "wrap",
            padding: "6px 12px",
          },
        },
        message: { minWidth: 0, flex: 1, overflowWrap: "anywhere" },
        action: {
          [phone]: {
            flexBasis: "100%",
            marginLeft: 0,
            marginRight: 0,
            padding: "0 0 4px 30px",
            justifyContent: "flex-start",
          },
        },
      },
    },
    MuiTabs: {
      defaultProps: { allowScrollButtonsMobile: true },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { [phone]: { padding: 16 } },
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
          [phone]: { padding: "8px 14px" },
        },
        sizeSmall: { padding: "4px 10px" },
        text: { [phone]: { paddingLeft: 8, paddingRight: 8 } },
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
