import { RoutePath } from "../../const/route";

const isRootPath = (path: string) => path === RoutePath.Activities;
const isConnectionsPath = (path: string) => path === RoutePath.Connections;

const isActivePath = (path: string, location: string) => {
  return isRootPath(path)
    ? RoutePath.Activities === location
    : isConnectionsPath(path)
      ? location === RoutePath.Connections || location.startsWith(`${RoutePath.Connections}/`)
      : location.startsWith(path);
};

export { isActivePath };
