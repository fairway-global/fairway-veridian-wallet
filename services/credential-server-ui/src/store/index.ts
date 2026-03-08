import { configureStore } from "@reduxjs/toolkit";
import { stateCacheSlice } from "./reducers/stateCache";
import connectionsReducer from "./reducers/connectionsSlice";
import schemasReducer from "./reducers/schemasSlice";
import authReducer from "./reducers/authSlice";
import notificationsReducer from "./reducers/notificationsSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    stateCache: stateCacheSlice.reducer,
    connections: connectionsReducer,
    schemasCache: schemasReducer,
    notifications: notificationsReducer,
  },
});

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export type { AppDispatch, RootState };

export { store };
