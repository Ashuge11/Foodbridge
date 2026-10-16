import { z } from "zod";
import { Notification } from "../models/Notification.js";

const paginationSchema = z.object({
  state: z.enum(["all", "unread"]).default("all"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

export async function listNotifications(req, res, next) {
  try {
    const parsed = paginationSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values."
      });
    }

    const { page, limit, state } = parsed.data;
    const filter = { user: req.user._id, deletedAt: null, ...(state === "unread" ? { readAt: null } : {}) };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Notification.countDocuments(filter),

      Notification.countDocuments({
        ...filter,
        readAt: null
      })
    ]);

    res.json({
      success: true,
      notifications,
      total,
      unreadCount,
      page,
      limit
    });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req, res, next) {
  try {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID."
      });
    }

    const filter = {
      _id: req.params.id,
      user: req.user._id,
      deletedAt: null
    };

    // Preserve the first read timestamp on repeated requests.
    let notification = await Notification.findOneAndUpdate(
      {
        ...filter,
        readAt: null
      },
      {
        $set: { readAt: new Date() }
      },
      {
        returnDocument: "after",
        runValidators: true
      }
    );

    if (!notification) {
      notification = await Notification.findOne(filter);
    }

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      {
        user: req.user._id,
        deletedAt: null,
        readAt: null
      },
      {
        $set: { readAt: new Date() }
      }
    );

    res.json({
      success: true,
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
}

// Event messages are immutable. Users manage their own read state and inbox.
export async function markUnread(req, res, next) {
  try {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID." });
    }
    const notification = await Notification.findOneAndUpdate({
      _id: req.params.id, user: req.user._id, deletedAt: null
    }, { $set: { readAt: null } }, { returnDocument: "after", runValidators: true });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found." });
    res.json({ success: true, notification });
  } catch (error) { next(error); }
}

export async function deleteNotification(req, res, next) {
  try {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID." });
    }
    // Keep the event key and recipient for deduplication and cancellation audiences.
    const notification = await Notification.findOneAndUpdate({
      _id: req.params.id, user: req.user._id, deletedAt: null
    }, { $set: { deletedAt: new Date() } }, { returnDocument: "after", runValidators: true });
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found." });
    res.json({ success: true, message: "Notification deleted." });
  } catch (error) { next(error); }
}

export async function deleteReadNotifications(req, res, next) {
  try {
    const result = await Notification.updateMany({
      user: req.user._id, deletedAt: null, readAt: { $ne: null }
    }, { $set: { deletedAt: new Date() } });
    res.json({ success: true, updatedCount: result.modifiedCount });
  } catch (error) { next(error); }
}
