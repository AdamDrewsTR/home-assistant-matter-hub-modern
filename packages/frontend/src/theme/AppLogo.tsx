import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Link } from "react-router";
import SvgLogo from "../assets/hamh-logo.svg?react";
import { navigation } from "../routes.tsx";

export const AppLogo = (props: { large: boolean }) => {
  return (
    <Box
      component={Link}
      to={navigation.dashboard}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        flexGrow: 1,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <SvgLogo style={{ height: "40px" }} />
      <Typography
        variant="inherit"
        component="span"
        sx={{
          mr: 1,
          ml: 1.5,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          whiteSpace: "nowrap",
        }}
      >
        {props.large ? "matter hub / modern" : "matter modern"}
      </Typography>
    </Box>
  );
};
