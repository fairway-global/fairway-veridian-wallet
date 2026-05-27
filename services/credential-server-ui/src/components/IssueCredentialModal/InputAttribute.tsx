import { Box, MenuItem, TextField } from "@mui/material";
import { InputAttributeProps } from "./IssueCredentialModal.types";
import {
  formatTemplateAttributeLabel,
  getTemplateAttributeInputConfig,
  normalizeTemplateAttributeType,
  normalizeTemplateAttributeValueForInput,
} from "../../utils/templateAttributeFields";

interface AttributeSchema {
  type: string;
  format?: string;
  [key: string]: unknown;
}

const InputAttribute = ({
  attributes,
  value,
  setValue,
  required,
  properties,
}: InputAttributeProps & { properties: Record<string, AttributeSchema> }) => {
  return (
    <Box className="input-attribute">
      {attributes.map((attribute) => {
        const inferredType = normalizeTemplateAttributeType({
          name: attribute,
          type: properties?.[attribute]?.type,
          format: properties?.[attribute]?.format,
        });
        const inputValue = normalizeTemplateAttributeValueForInput(
          {
            name: attribute,
            type: inferredType,
          },
          value[attribute]
        );
        const inputConfig = getTemplateAttributeInputConfig(
          {
            name: attribute,
            type: inferredType,
          },
          inputValue
        );

        if (inputConfig.control === "select") {
          return (
            <TextField
              key={attribute}
              select
              fullWidth
              label={formatTemplateAttributeLabel(attribute)}
              value={inputValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (inferredType === "boolean") {
                  setValue(
                    attribute,
                    nextValue === "" ? "" : nextValue === "true"
                  );
                  return;
                }

                setValue(attribute, nextValue);
              }}
            >
              {(inputConfig.options || []).map((option) => (
                <MenuItem
                  key={`${attribute}-${option.value}`}
                  value={option.value}
                >
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          );
        }

        if (inputConfig.control === "date") {
          return (
            <TextField
              key={attribute}
              fullWidth
              type="date"
              label={formatTemplateAttributeLabel(attribute)}
              value={inputValue}
              onChange={(event) => setValue(attribute, event.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          );
        }

        return (
          <TextField
            key={attribute}
            fullWidth
            label={formatTemplateAttributeLabel(attribute)}
            type={
              inputConfig.control === "number"
                ? "number"
                : inputConfig.htmlInputType || "text"
            }
            value={inputValue}
            onChange={(event) => {
              if (inputConfig.control === "number") {
                setValue(attribute, event.target.value);
                return;
              }

              setValue(attribute, event.target.value);
            }}
            inputProps={
              inputConfig.control === "number"
                ? {
                    step: inferredType === "integer" ? 1 : "any",
                  }
                : undefined
            }
          />
        );
      })}
    </Box>
  );
};

export { InputAttribute };
