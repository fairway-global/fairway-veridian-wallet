import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import LogoSmall from "../../../../assets/fairway-logo-small.png";
import { i18n } from "../../../../i18n";
import { isActivePath } from "../../helper";
import { DrawerContentProps } from "./DrawerContent.types";

const DrawerContent = ({
  handleDrawerToggle,
  menuItems,
}: DrawerContentProps) => {
  const location = useLocation();
  const getIcon = (icons: React.ReactElement[], isActive: boolean) =>
    isActive ? icons[0] : icons[1];

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
    </Box>
  );
};

export { DrawerContent };
