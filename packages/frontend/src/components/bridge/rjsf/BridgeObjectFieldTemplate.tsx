import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { generateTemplates } from "@rjsf/mui";
import type { ObjectFieldTemplateProps } from "@rjsf/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const muiTemplates = generateTemplates();
const DefaultObjectFieldTemplate = muiTemplates.ObjectFieldTemplate!;

export function BridgeObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const fieldId = props.fieldPathId?.$id ?? "";

  if (fieldId === "root") return <GroupedConfig {...props} />;

  if (fieldId === "root_filter") {
    return <CollapsibleFilterTemplate {...props} />;
  }

  function GroupedConfig(props: ObjectFieldTemplateProps) {
    const { t } = useTranslation();
    const groupFor = (name: string) => {
      if (name === "filter") return "sharing";
      if (name === "featureFlags") return "behavior";
      if (["name", "port", "countryCode", "icon"].includes(name))
        return "general";
      return "identity";
    };
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        {["general", "sharing", "behavior", "identity"].map((group) => {
          const fields = props.properties.filter(
            (field) => groupFor(field.name) === group,
          );
          if (!fields.length) return null;
          if (group === "sharing")
            return (
              <Box key={group}>
                {fields.map((field) => (
                  <Box key={field.name}>{field.content}</Box>
                ))}
              </Box>
            );
          return (
            <Accordion
              key={group}
              defaultExpanded={group === "general"}
              disableGutters
              variant="outlined"
              sx={{ "&::before": { display: "none" } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>
                  {t(`workspace.configGroups.${group}`)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {fields.map((field) => (
                  <Box key={field.name} sx={{ mb: 2 }}>
                    {field.content}
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    );
  }

  return <DefaultObjectFieldTemplate {...props} />;
}

function CollapsibleFilterTemplate(props: ObjectFieldTemplateProps) {
  const includeCount =
    (props.formData?.include as unknown[] | undefined)?.length ?? 0;
  const excludeCount =
    (props.formData?.exclude as unknown[] | undefined)?.length ?? 0;
  const totalRules = includeCount + excludeCount;

  const [expanded, setExpanded] = useState(totalRules > 0);

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      variant="outlined"
      disableGutters
      sx={{
        borderRadius: 2,
        "&::before": { display: "none" },
        overflow: "hidden",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          "& .MuiAccordionSummary-content": {
            alignItems: "center",
            gap: 1.5,
          },
        }}
      >
        <FilterListIcon fontSize="small" color="action" />
        <Typography variant="subtitle1" fontWeight={600}>
          Entity Filters
        </Typography>
        <Badge
          badgeContent={totalRules}
          color="primary"
          sx={{ ml: 1 }}
          max={99}
        >
          <Box />
        </Badge>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {expanded
            ? "Click to collapse"
            : `${totalRules} rule${totalRules !== 1 ? "s" : ""} configured`}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pb: 2 }}>
        {props.properties.map((prop) => (
          <div key={prop.name}>{prop.content}</div>
        ))}
      </AccordionDetails>
    </Accordion>
  );
}
