import { Router } from "express";

import { authenticate } from "../middleware/auth.js";

import {
  markUnread,
  deleteNotification,
  deleteReadNotifications,
  listNotifications,
  markRead,
  markAllRead
} from "../controllers/notificationController.js";

const router = Router();

router.use(authenticate);

router.get("/", listNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

router.patch("/:id/unread", markUnread);
router.delete("/read", deleteReadNotifications);
router.delete("/:id", deleteNotification);

export default router;