import { ChevronLeftOutlined } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { PageHeaderProps } from "./PageHeader.types";

export const PageHeader = ({ title, onBack, action, sx }: PageHeaderProps) => {
  return (
    <Box
      className="page-header"
      sx={{
        "&": (theme) => ({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          [theme.breakpoints.down("sm")]: {
            flexDirection: "column",
            alignItems: "start",
          },
        }),
        ...sx,
      }}
    >
      <Box
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          [theme.breakpoints.down("sm")]: {
            marginBottom: "1rem",
          },
        })}
      >
        {onBack && (
          <ChevronLeftOutlined
            sx={{ cursor: "pointer" }}
            onClick={onBack}
          />
        )}
        <Typography
          variant="h1"
          component="h1"
          sx={{
            wordBreak: "break-word",
          }}
        >
          {title}
        </Typography>
      </Box>
      <Box
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          [theme.breakpoints.down("sm")]: {
            width: "100%",
            "& > *": {
              maxWidth: "100%",
            },
            "& > .MuiBox-root": {
              width: "100%",
              display: "flex",
              flexWrap: "wrap",
            },
          },
        })}
      >
        {action}
      </Box>
    </Box>
  );
};
