import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { PageHeader } from "../../components/PageHeader";
import { i18n } from "../../i18n";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../store/reducers/notificationsSlice";
import { formatDateTime } from "../../utils/dateFormatter";

const Notifications = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(getNotifications);

  return (
    <Box sx={{ padding: "0 2.5rem 2.5rem" }}>
      <PageHeader
        title={i18n.t("pages.notifications.title")}
        action={
          <Button
            variant="contained"
            className="neutral-button"
            onClick={() => dispatch(markAllNotificationsRead())}
            disabled={!notifications.some((item) => !item.read)}
          >
            {i18n.t("pages.notifications.actions.markAllRead")}
          </Button>
        }
        sx={{ margin: "1.5rem 0" }}
      />

      {notifications.length === 0 ? (
        <Paper sx={{ p: 3, borderRadius: "1rem" }}>
          <Typography color="text.secondary">
            {i18n.t("pages.notifications.empty")}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {notifications.map((notification) => (
            <Paper
              key={notification.id}
              sx={{
                p: 2,
                borderRadius: "1rem",
                border: notification.read
                  ? "1px solid rgba(var(--text-color-rgb), 0.12)"
                  : "1px solid rgba(var(--primary-color-rgb), 0.5)",
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
              >
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ mb: 0.5 }}
                  >
                    {notification.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {notification.message}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    {formatDateTime(new Date(notification.createdAt))}
                  </Typography>
                </Box>

                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  {!notification.read && (
                    <Chip
                      size="small"
                      color="primary"
                      label={i18n.t("pages.notifications.badges.new")}
                    />
                  )}
                  {!notification.read && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() =>
                        dispatch(markNotificationRead(notification.id))
                      }
                    >
                      {i18n.t("pages.notifications.actions.markRead")}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export { Notifications };
