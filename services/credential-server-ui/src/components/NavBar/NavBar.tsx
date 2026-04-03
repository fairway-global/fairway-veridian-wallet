import {
  Badge as BadgeFull,
  BadgeOutlined,
  DashboardOutlined,
  DashboardRounded,
  Description as DescriptionFull,
  DescriptionOutlined,
  Group as GroupFull,
  GroupOutlined,
  LogoutRounded,
  ManageAccounts,
  ManageAccountsOutlined,
  Menu as MenuIcon,
  Notifications as NotificationsFull,
  NotificationsOutlined,
  Rule,
  RuleOutlined,
  Settings as SettingsFull,
  SettingsOutlined,
  SwapHorizontalCircle,
  SwapHorizontalCircleOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LogoLong from "../../assets/fairway-logo-long.png";
import { RoutePath } from "../../const/route";
import { i18n } from "../../i18n";
import { DrawerContent } from "./components/DrawerContent";
import "./NavBar.scss";
import { isActivePath } from "./helper";
import { AuthService } from "../../services";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearSession,
  DashboardMode,
  getCurrentUser,
  getRefreshToken,
} from "../../store/reducers/authSlice";
import { getUnreadNotificationsCount } from "../../store/reducers/notificationsSlice";

interface Props {
  mode: DashboardMode;
  window?: () => Window;
}

const drawerWidth = 240;

const issuerMenuItems = [
  {
    key: "activities",
    label: i18n.t("navbar.activities"),
    path: RoutePath.Activities,
    icons: [<DashboardRounded />, <DashboardOutlined />],
  },
  {
    key: "connections",
    label: i18n.t("navbar.connections"),
    path: RoutePath.Connections,
    icons: [<GroupFull />, <GroupOutlined />],
  },
  {
    key: "templates",
    label: i18n.t("navbar.templates"),
    path: RoutePath.Templates,
    icons: [<DescriptionFull />, <DescriptionOutlined />],
  },
  {
    key: "credentials",
    label: i18n.t("navbar.credentialsManagement"),
    path: RoutePath.Credentials,
    icons: [<BadgeFull />, <BadgeOutlined />],
  },
];

const verifierMenuItems = [
  {
    key: "activities",
    label: i18n.t("navbar.activities"),
    path: RoutePath.Activities,
    icons: [<DashboardRounded />, <DashboardOutlined />],
  },
  {
    key: "connections",
    label: i18n.t("navbar.connections"),
    path: RoutePath.Connections,
    icons: [<GroupFull />, <GroupOutlined />],
  },
  {
    key: "requestPresentation",
    label: i18n.t("navbar.requestPresentation"),
    path: RoutePath.RequestPresentation,
    icons: [<SwapHorizontalCircle />, <SwapHorizontalCircleOutlined />],
  },
];

const adminMenuItems = [
  {
    key: "adminUsers",
    label: "Users",
    path: RoutePath.AdminUsers,
    icons: [<ManageAccounts />, <ManageAccountsOutlined />],
  },
  {
    key: "adminRequests",
    label: "Requests",
    path: RoutePath.AdminRequests,
    icons: [<Rule />, <RuleOutlined />],
  },
];

const getIcon = (icons: React.ReactElement[], isActive: boolean) =>
  isActive ? icons[0] : icons[1];

const NavBar = ({ mode, window }: Props) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAppSelector(getCurrentUser);
  const refreshToken = useAppSelector(getRefreshToken);
  const unreadNotificationsCount = useAppSelector(getUnreadNotificationsCount);
  const displayMenuItems =
    mode === "admin"
      ? adminMenuItems
      : mode === "verifier"
        ? verifierMenuItems
        : issuerMenuItems;
  const homePath = mode === "admin" ? RoutePath.AdminUsers : RoutePath.Activities;
  const dashboardLabel = user
    ? mode === "admin"
      ? "Admin dashboard"
      : `${mode === "verifier" ? "Verifier" : "Issuer"} workspace`
    : "";
  const dashboardMeta = user
    ? mode === "admin"
      ? user.email
      : `${user.email} / ${user.issuerCode}`
    : "";
  const profileInitial = (
    user?.email?.trim().charAt(0) ||
    user?.issuerCode?.trim().charAt(0) ||
    user?.role?.trim().charAt(0) ||
    "U"
  ).toUpperCase();

  const handleDrawerToggle = () => {
    setMobileOpen((prevState) => !prevState);
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
    } catch {
      // ignore logout errors and always clear local session
    } finally {
      dispatch(clearSession());
    }
  };

  const container =
    window !== undefined ? () => window().document.body : undefined;

  return (
    <AppBar
      id="navBar"
      position="static"
      sx={{ boxShadow: 0, backgroundColor: "transparent" }}
    >
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          className="dashboard-toolbar"
        >
          <Box
            className="nav-tablet"
            sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}
          >
            <IconButton
              color="inherit"
              disableRipple
              aria-label="open drawer menu"
              edge="start"
              className="menu-button"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: "none" } }}
            >
              <MenuIcon className="menu-icon" />
              <Typography>{i18n.t("navbar.menu")}</Typography>
            </IconButton>
            <Button
              component={Link}
              to={homePath}
              className="logo-button mobile-logo-button"
              disableRipple
            >
              <img
                className="header-logo"
                alt="fairway-logo"
                src={LogoLong}
              />
            </Button>
          </Box>
          <Box
            component="nav"
            sx={{ width: { md: drawerWidth }, display: { md: "none" } }}
            aria-label="mobile menu"
          >
            <Drawer
              container={container}
              variant="temporary"
              open={mobileOpen}
              onClose={handleDrawerToggle}
              ModalProps={{
                keepMounted: true,
              }}
              sx={{
                display: { xs: "block", sm: "block", md: "none" },
                "& .MuiDrawer-paper": {
                  boxSizing: "border-box",
                  width: drawerWidth,
                },
              }}
            >
              <DrawerContent
                handleDrawerToggle={handleDrawerToggle}
                menuItems={displayMenuItems}
              />
            </Drawer>
          </Box>
          <Box
            className="nav-left"
            sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}
          >
            <Button
              component={Link}
              to={homePath}
              disableRipple
              className="logo-button"
            >
              <img
                className="header-logo"
                alt="fairway-logo-long"
                src={LogoLong}
              />
            </Button>
            {displayMenuItems.map((item) => {
              const isActive = isActivePath(item.path, location.pathname);

              return (
                <MenuItem
                  key={item.key}
                  component={Link}
                  to={item.path}
                  disableRipple
                  className={isActive ? "active" : ""}
                >
                  <Typography textAlign="center">
                    {getIcon(item.icons, isActive)}
                    {item.label}
                  </Typography>
                  {isActive && <div className="active-bar" />}
                </MenuItem>
              );
            })}
          </Box>
          <Box
            className="nav-right"
            sx={{ display: { xs: "none", sm: "flex" } }}
          >
            {mode !== "admin" && (
              <>
                <IconButton
                  size="large"
                  aria-label="show new notifications"
                  color="inherit"
                  component={Link}
                  to={"/notifications"}
                  disableRipple
                  className={location.pathname === "/notifications" ? "active" : ""}
                >
                  <Badge
                    badgeContent={unreadNotificationsCount}
                    color="error"
                  >
                    {location.pathname === "/notifications" ? (
                      <NotificationsFull />
                    ) : (
                      <NotificationsOutlined />
                    )}
                  </Badge>
                </IconButton>
                <IconButton
                  size="large"
                  aria-label="show settings"
                  color="inherit"
                  component={Link}
                  to={"/settings"}
                  disableRipple
                  className={location.pathname === "/settings" ? "active" : ""}
                >
                  <Badge>
                    {location.pathname === "/settings" ? (
                      <SettingsFull />
                    ) : (
                      <SettingsOutlined />
                    )}
                  </Badge>
                </IconButton>
              </>
            )}
            <Box className="nav-profile-pill">
              <Box className="nav-profile-avatar">{profileInitial}</Box>
              <Box className="nav-profile-copy">
                <Typography
                  variant="body2"
                  className="nav-profile-title"
                >
                  {dashboardLabel}
                </Typography>
                <Typography
                  variant="caption"
                  className="nav-profile-subtitle"
                >
                  {dashboardMeta}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="text"
              onClick={handleLogout}
              className="nav-logout-button"
              startIcon={<LogoutRounded />}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export { NavBar };
