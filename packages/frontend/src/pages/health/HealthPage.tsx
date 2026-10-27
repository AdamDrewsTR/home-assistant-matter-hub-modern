import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { useState } from "react";
import { HealthDashboard } from "../../components/health/HealthDashboard.tsx";
import { NetworkDiagnosticCard } from "../../components/health/NetworkDiagnosticCard.tsx";
import { TranslationEditor } from "../../components/i18n/TranslationEditor.tsx";
import { SystemInfo } from "../../components/system/SystemInfo.tsx";
import { LiveEventLog } from "../diagnostics/DiagnosticsPage.tsx";

export const HealthPage = ({
  section,
}: {
  section?: "overview" | "events" | "network" | "system" | "translations";
}) => {
  const [sortField, setSortField] = useState<"name" | "created">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {(!section || section === "overview") && (
        <HealthDashboard
          sortField={sortField}
          sortDirection={sortDirection}
          onSortFieldChange={setSortField}
          onSortDirectionChange={setSortDirection}
        />
      )}
      {(!section || section === "events") && (
        <Box sx={{ px: 2 }}>
          <LiveEventLog sortField={sortField} sortDirection={sortDirection} />
        </Box>
      )}
      {(!section || section === "network") && (
        <Box sx={{ px: 2 }}>
          <NetworkDiagnosticCard />
        </Box>
      )}
      {(!section || section === "system") && (
        <Box sx={{ px: 2, pb: 2 }}>
          <SystemInfo />
        </Box>
      )}
      {!section && <Divider />}
      {(!section || section === "translations") && <TranslationEditor />}
    </Box>
  );
};
