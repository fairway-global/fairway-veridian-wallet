import { Box, Paper, Typography } from "@mui/material";
import { ReactNode } from "react";
import LogoLong from "../../assets/fw-white-logo.png";
import "./Login.scss";

interface AuthShellProps {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
  pageClassName?: string;
}

const AuthShell = ({
  title,
  subtitle,
  footer,
  children,
  pageClassName,
}: AuthShellProps) => {
  return (
    <Box className={["login-page", pageClassName].filter(Boolean).join(" ")}>
      <Paper className="login-card">
        <Box className="login-panel login-panel--form">
          <Box className="login-brand">
            <img src={LogoLong} alt="Fairwallet" />
          </Box>

          <Box className="login-copy">
            <Typography className="login-title" component="h1">
              {title}
            </Typography>
            <Typography className="login-subtitle">{subtitle}</Typography>
          </Box>

          {children}

          {footer ? <Box className="login-footer-copy">{footer}</Box> : null}
        </Box>

        <Box className="login-panel login-panel--welcome">
          <Box className="welcome-orb welcome-orb--top" />
          <Box className="welcome-orb welcome-orb--bottom" />
          <Typography className="welcome-eyebrow">Welcome to</Typography>
          <Typography className="welcome-title">
            Fairwallet Credential Manager
          </Typography>
          <Typography className="welcome-body">
            Manage credential issuance, identity verification, and trusted digital
            workflows in one secure place. Built for institutions to issue and
            manage credentials with clarity, speed, and confidence.
          </Typography>
          <Box className="welcome-stat">
            <Typography className="welcome-stat-label">
              Trusted workspace
            </Typography>
            <Typography className="welcome-stat-value">
              Secure credential operations for issuers and verifiers
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export { AuthShell };
