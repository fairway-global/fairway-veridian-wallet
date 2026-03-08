import { Outlet } from "react-router";
import { NavBar } from "../../components/NavBar/NavBar";
import { DashboardMode } from "../../store/reducers/authSlice";

interface LayoutProps {
  mode: DashboardMode;
}

const Layout = ({ mode }: LayoutProps) => {
  return (
    <>
      <NavBar mode={mode} />
      <main className="dashboard-main">
        <Outlet />
      </main>
    </>
  );
};

export { Layout };
