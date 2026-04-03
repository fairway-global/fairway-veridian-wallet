import { Outlet } from "react-router";
import { NavBar } from "../../components/NavBar/NavBar";
import { DashboardMode } from "../../store/reducers/authSlice";

interface LayoutProps {
  mode: DashboardMode;
}

const Layout = ({ mode }: LayoutProps) => {
  return (
    <div className={`dashboard-shell dashboard-shell--${mode}`}>
      <NavBar mode={mode} />
      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
};

export { Layout };
