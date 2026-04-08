interface MenuItem {
  key: string;
  path: string;
  label: string;
  icons: React.ReactElement[];
}

interface DrawerContentProps {
  handleDrawerToggle: () => void;
  menuItems: MenuItem[];
  dashboardLabel: string;
  dashboardMeta: string;
  profileInitial: string;
  unreadNotificationsCount: number;
  showUtilityLinks: boolean;
  onLogout: () => void;
}

export type { DrawerContentProps };
