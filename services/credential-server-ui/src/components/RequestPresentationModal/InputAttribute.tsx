import { Box, Chip, Typography } from "@mui/material";
import { i18n } from "../../i18n";
import { AppInput } from "../AppInput";
import { InputAttributeProps } from "./RequestPresentationModal.types";

const InputAttribute = ({
  attributeOptional,
  attributes,
  value,
  setValue,
}: InputAttributeProps) => {
  if (!attributes) return null;

  return (
    <Box className="input-attribute">
      {attributes.map((attribute) => {
        return (
          <Box
            key={attribute.name}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ color: "var(--text-color)" }}
              >
                {attribute.label}
              </Typography>
              {attribute.required && (
                <Chip
                  label={i18n.t("pages.requestPresentation.modal.inputAttribute.required")}
                  size="small"
                  sx={{
                    backgroundColor: "var(--color-success-100)",
                    color: "var(--color-success-900)",
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>
            <AppInput
              fullWidth
              label={attribute.label}
              optional={attributeOptional}
              value={value[attribute.name] || ""}
              onChange={(e) => setValue(attribute.name, e.target.value)}
              placeholder={i18n.t(
                "pages.requestPresentation.modal.inputAttribute.placeholder"
              )}
            />
            {attribute.description && (
              <Typography
                variant="body2"
                sx={{ color: "var(--color-neutral-600)" }}
              >
                {attribute.description}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export { InputAttribute };
