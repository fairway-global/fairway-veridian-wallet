import {
  LogoutRounded,
  NotificationsOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  Badge,
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import LogoSmall from "../../../../assets/fairway-logo-small.png";
import { RoutePath } from "../../../../const/route";
import { i18n } from "../../../../i18n";
import { isActivePath } from "../../helper";
import { DrawerContentProps } from "./DrawerContent.types";

const DrawerContent = ({
  handleDrawerToggle,
  menuItems,
  dashboardLabel,
  dashboardMeta,
  profileInitial,
  unreadNotificationsCount,
  showUtilityLinks,
  onLogout,
}: DrawerContentProps) => {
  const location = useLocation();
  const getIcon = (icons: React.ReactElement[], isActive: boolean) =>
    isActive ? icons[0] : icons[1];
  const utilityLinks = showUtilityLinks
    ? [
        {
          key: "notifications",
          label: i18n.t("navbar.notifications"),
          path: RoutePath.Notifications,
          icon: (
            <Badge
              badgeContent={unreadNotificationsCount}
              color="error"
            >
              <NotificationsOutlined />
            </Badge>
          ),
        },
        {
          key: "settings",
          label: i18n.t("navbar.settings"),
          path: RoutePath.Settings,
          icon: <SettingsOutlined />,
        },
      ]
    : [];

  return (
    <Box
      id="drawer"
      onClick={handleDrawerToggle}
      color="text.primary"
      bgcolor="background.default"
    >
      <Box className="drawer-header">
        <img
          className="drawer-logo"
          src={LogoSmall}
          alt="fairwallet logo"
        />
        <Box className="drawer-copy">
          <Typography
            variant="overline"
            className="drawer-eyebrow"
          >
            Fairwallet
          </Typography>
          <Typography
            variant="h6"
            className="drawer-title"
          >
            {i18n.t("navbar.menu")}
          </Typography>
        </Box>
      </Box>
      <Box className="drawer-profile-card">
        <Box className="drawer-profile-avatar">{profileInitial}</Box>
        <Box className="drawer-profile-copy">
          <Typography className="drawer-profile-title">
            {dashboardLabel}
          </Typography>
          <Typography className="drawer-profile-subtitle">
            {dashboardMeta}
          </Typography>
        </Box>
      </Box>
      {utilityLinks.length > 0 && (
        <List className="drawer-utility-list">
          {utilityLinks.map((item) => {
            const isActive = isActivePath(item.path, location.pathname);

            return (
              <ListItem
                key={item.key}
                component={Link}
                to={item.path}
                disablePadding
              >
                <ListItemButton className={isActive ? "active" : ""}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                  {isActive && <div className="active-bar" />}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
      <List>
        {menuItems.map((item) => {
          const isActive = isActivePath(item.path, location.pathname);

          return (
            <ListItem
              key={item.key}
              component={Link}
              to={item.path}
              disablePadding
            >
              <ListItemButton className={isActive ? "active" : ""}>
                <ListItemIcon>{getIcon(item.icons, isActive)}</ListItemIcon>
                <ListItemText primary={item.label} />
                {isActive && <div className="active-bar" />}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Button
        variant="text"
        startIcon={<LogoutRounded />}
        className="drawer-logout-button"
        onClick={onLogout}
      >
        {i18n.t("navbar.logout")}
      </Button>
    </Box>
  );
};

export { DrawerContent };
