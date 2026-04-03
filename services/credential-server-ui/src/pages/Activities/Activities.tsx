import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import SwapHorizontalCircleRoundedIcon from "@mui/icons-material/SwapHorizontalCircleRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import { Box, Button, Chip, Typography } from "@mui/material";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { i18n } from "../../i18n";
import { useAppSelector } from "../../store/hooks";
import { getCurrentUser } from "../../store/reducers/authSlice";
import { getRoleView } from "../../store/reducers/stateCache";
import { RootState } from "../../store";
import { RoleIndex } from "../../components/NavBar/constants/roles";
import { formatDate } from "../../utils/dateFormatter";
import { RoutePath } from "../../const/route";
import "./Activities.scss";

const Activities = () => {
  const currentUser = useAppSelector(getCurrentUser);
  const roleViewIndex = useAppSelector(getRoleView) as RoleIndex;
  const contacts = useAppSelector((state: RootState) => state.connections.contacts);
  const credentials = useAppSelector((state: RootState) => state.connections.credentials);

  const isVerifier = roleViewIndex === RoleIndex.VERIFIER;
  const totalConnections = contacts.length;
  const totalCredentials = credentials.length;

  const connectionsWithCredentialHistory = useMemo(
    () => new Set(credentials.map((credential) => credential.contactId)).size,
    [credentials]
  );

  const coverageRatio = totalConnections
    ? Math.round((connectionsWithCredentialHistory / totalConnections) * 100)
    : 0;

  const newThisWeek = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return contacts.filter((contact) => {
      const createdAt = new Date(contact.createdAt).getTime();
      return Number.isFinite(createdAt) && now - createdAt <= sevenDaysMs;
    }).length;
  }, [contacts]);

  const latestContact = useMemo(
    () =>
      [...contacts].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )[0],
    [contacts]
  );

  const topCredentialTitle = useMemo(() => {
    if (!credentials.length) {
      return "No credential activity yet";
    }

    const titleCounts = credentials.reduce((acc, credential) => {
      const title = credential.schema?.title || credential.sad?.s || "Credential";
      acc.set(title, (acc.get(title) || 0) + 1);
      return acc;
    }, new Map<string, number>());

    return [...titleCounts.entries()].sort((left, right) => right[1] - left[1])[0][0];
  }, [credentials]);

  const weeklyActivity = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const count = contacts.filter((contact) => {
        const createdAt = new Date(contact.createdAt).getTime();
        return createdAt >= day.getTime() && createdAt < nextDay.getTime();
      }).length;

      return {
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        count,
      };
    });

    const highestCount = Math.max(...days.map((day) => day.count), 1);

    return days.map((day) => ({
      ...day,
      height: `${Math.max(18, Math.round((day.count / highestCount) * 100))}%`,
      isPeak: day.count > 0 && day.count === highestCount,
    }));
  }, [contacts]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Trusted connections",
        value: totalConnections.toString(),
        caption: isVerifier
          ? "Holders ready for presentation workflows."
          : "Contacts ready for issuance and follow-up.",
        icon: <GroupsRoundedIcon />,
        accent: true,
      },
      {
        label: isVerifier ? "Credential coverage" : "Credentials issued",
        value: isVerifier ? `${coverageRatio}%` : totalCredentials.toString(),
        caption: isVerifier
          ? `${connectionsWithCredentialHistory} holders already have credential history.`
          : `${connectionsWithCredentialHistory} holders already received credentials.`,
        icon: <BadgeRoundedIcon />,
      },
      {
        label: "New this week",
        value: newThisWeek.toString(),
        caption: "Fresh counterparties added in the last seven days.",
        icon: <CalendarMonthRoundedIcon />,
      },
      {
        label: "Latest contact",
        value: latestContact?.alias || "Waiting",
        caption: latestContact
          ? `Added ${formatDate(latestContact.createdAt)}`
          : "Your newest relationship will appear here.",
        icon: <NorthEastRoundedIcon />,
      },
    ],
    [
      connectionsWithCredentialHistory,
      coverageRatio,
      isVerifier,
      latestContact,
      newThisWeek,
      totalConnections,
      totalCredentials,
    ]
  );

  const actionCards = useMemo(
    () =>
      isVerifier
        ? [
            {
              title: i18n.t("navbar.connections"),
              description:
                "Open your trusted holder directory, inspect relationship details, and launch verification actions from the right record.",
              to: RoutePath.Connections,
              icon: <GroupsRoundedIcon />,
            },
            {
              title: i18n.t("navbar.requestPresentation"),
              description:
                "Create and monitor presentation requests with a dedicated verifier workflow.",
              to: RoutePath.RequestPresentation,
              icon: <SwapHorizontalCircleRoundedIcon />,
            },
            {
              title: i18n.t("pages.notifications.title"),
              description:
                "Review live event updates, read requests, and keep follow-up items from slipping.",
              to: RoutePath.Notifications,
              icon: <NotificationsRoundedIcon />,
            },
          ]
        : [
            {
              title: i18n.t("navbar.connections"),
              description:
                "Jump into your holder directory to add new relationships or issue directly from a connection.",
              to: RoutePath.Connections,
              icon: <GroupsRoundedIcon />,
            },
            {
              title: i18n.t("navbar.templates"),
              description:
                "Review credential templates, maintain schema-linked forms, and keep auto-issue rules tidy.",
              to: RoutePath.Templates,
              icon: <DescriptionRoundedIcon />,
            },
            {
              title: i18n.t("navbar.credentialsManagement"),
              description:
                "Open issued credential records, review status changes, and handle lifecycle actions quickly.",
              to: RoutePath.Credentials,
              icon: <BadgeRoundedIcon />,
            },
          ],
    [isVerifier]
  );

  const dashboardTitle = isVerifier ? "Verifier workspace" : "Issuer workspace";
  const dashboardDescription = isVerifier
    ? "Track holder readiness, surface presentation activity, and keep the next move obvious from a single dashboard."
    : "Watch your network grow, keep credential issuance in focus, and jump straight into the operational pages that matter.";

  return (
    <Box
      className="activities-page"
      sx={{ padding: "0 2.5rem 2.5rem" }}
    >
      <Box className="activities-hero">
        <Box className="activities-hero-main">
          <Box className="activities-hero-copy">
            <Typography className="activities-hero-kicker">
              {dashboardTitle}
            </Typography>
            <Typography
              className="activities-hero-title"
              component="h1"
            >
              Activities
            </Typography>
            <Typography className="activities-hero-description">
              {dashboardDescription}
            </Typography>
            <Box className="activities-hero-tags">
              <Chip label={`${totalConnections} trusted contacts`} />
              <Chip label={`${connectionsWithCredentialHistory} with credential history`} />
              <Chip label={`${newThisWeek} added this week`} />
            </Box>
          </Box>
          <Box className="activities-hero-actions">
            <Button
              component={Link}
              to={RoutePath.Connections}
              className="primary-button"
              variant="contained"
              disableElevation
              disableRipple
              endIcon={<ArrowOutwardRoundedIcon />}
            >
              Open connections
            </Button>
          </Box>
        </Box>
        <Box className="activities-hero-sidecard">
          <Typography className="hero-sidecard-kicker">
            Workspace pulse
          </Typography>
          <Typography className="hero-sidecard-title">
            Live network activity in a calmer view.
          </Typography>
          <Typography className="hero-sidecard-copy">
            The same connections and credential data, presented with clearer contrast, stronger visual hierarchy, and easier jump-off points for demos and daily ops.
          </Typography>
          <Box className="hero-sidecard-metrics">
            <Box className="hero-metric">
              <span>Mode</span>
              <strong>{dashboardTitle}</strong>
            </Box>
            <Box className="hero-metric">
              <span>Workspace</span>
              <strong>{currentUser?.issuerCode || "Unassigned"}</strong>
            </Box>
            <Box className="hero-metric">
              <span>Most active credential</span>
              <strong>{topCredentialTitle}</strong>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box className="activities-summary-grid">
        {summaryCards.map((card) => (
          <Box
            key={card.label}
            className={`activities-stat-card${card.accent ? " accent" : ""}`}
          >
            <Box className="activities-stat-head">
              <Box className="activities-stat-icon">{card.icon}</Box>
            </Box>
            <Typography className="activities-stat-label">
              {card.label}
            </Typography>
            <Typography className="activities-stat-value">
              {card.value}
            </Typography>
            <Typography className="activities-stat-caption">
              {card.caption}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box className="activities-board">
        <Box className="activities-actions-shell">
          <Box className="activities-section-head">
            <Box>
              <Typography className="activities-section-kicker">
                Quick actions
              </Typography>
              <Typography className="activities-section-title">
                Move into the right workspace without hunting through the nav.
              </Typography>
            </Box>
          </Box>
          <Box className="activities-actions-grid">
            {actionCards.map((card) => (
              <Box
                key={card.title}
                className="activities-action-card"
              >
                <Box className="activities-action-icon">{card.icon}</Box>
                <Typography className="activities-action-title">
                  {card.title}
                </Typography>
                <Typography className="activities-action-description">
                  {card.description}
                </Typography>
                <Button
                  component={Link}
                  to={card.to}
                  className="activities-action-button"
                  endIcon={<ArrowOutwardRoundedIcon />}
                >
                  Open page
                </Button>
              </Box>
            ))}
          </Box>
        </Box>

        <Box className="activities-side-stack">
          <Box className="activities-side-card activity-card">
            <Box className="activities-side-head">
              <Typography className="activities-section-kicker">
                Connection rhythm
              </Typography>
              <AutoGraphRoundedIcon />
            </Box>
            <Typography className="activities-side-title">
              Activity over the last seven days
            </Typography>
            <Box className="activities-activity-chart">
              {weeklyActivity.map((day) => (
                <Box
                  key={day.label}
                  className="activities-activity-column"
                >
                  <Box
                    className={`activities-activity-bar${day.isPeak ? " peak" : ""}`}
                    sx={{ height: day.height }}
                  />
                  <Typography className="activities-activity-value">
                    {day.count}
                  </Typography>
                  <Typography className="activities-activity-label">
                    {day.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box className="activities-side-card spotlight-card">
            <Box className="activities-side-head">
              <Typography className="activities-section-kicker">
                Coverage snapshot
              </Typography>
              <VerifiedRoundedIcon />
            </Box>
            <Typography className="activities-side-title">
              {coverageRatio}% of connections have credential history
            </Typography>
            <Typography className="activities-side-copy">
              {isVerifier
                ? "Use this to spot holders who are already primed for presentation requests."
                : "Use this to see how widely credential issuance has already spread across your current network."}
            </Typography>
            <Box className="activities-coverage-track">
              <Box
                className="activities-coverage-progress"
                sx={{ width: `${coverageRatio}%` }}
              />
            </Box>
            <Box className="activities-spotlight-list">
              <Box className="activities-spotlight-item">
                <span>Credential-bearing contacts</span>
                <strong>{connectionsWithCredentialHistory}</strong>
              </Box>
              <Box className="activities-spotlight-item">
                <span>Latest connection</span>
                <strong>{latestContact?.alias || "Waiting"}</strong>
              </Box>
              <Box className="activities-spotlight-item">
                <span>Top credential</span>
                <strong>{topCredentialTitle}</strong>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box className="activities-help-cta">
        <Box>
          <Typography className="activities-help-kicker">
            Need help?
          </Typography>
          <Typography className="activities-help-title">
            Check our guide at fairwallet.et
          </Typography>
          <Typography className="activities-help-copy">
            Walk through setup guidance, credential flows, and dashboard usage without leaving your workspace context.
          </Typography>
        </Box>
        <Button
          component="a"
          href="https://fairwallet.et"
          target="_blank"
          rel="noreferrer"
          className="activities-help-button"
          endIcon={<ArrowOutwardRoundedIcon />}
        >
          Open guide
        </Button>
      </Box>
    </Box>
  );
};

export { Activities };
