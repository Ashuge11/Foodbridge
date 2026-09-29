import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    donation: {
      type: Schema.Types.ObjectId,
      ref: "Donation"
    },

    // Same event key may be used for different recipients.
    eventKey: {
      type: String,
      required: true
    },

    type: {
      type: String,
      required: true,
      maxlength: 50
    },

    title: {
      type: String,
      required: true,
      maxlength: 150
    },

    message: {
      type: String,
      required: true,
      maxlength: 1000
    },

    // null = unread; a Date = read.
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate persistent notifications during worker retries.
notificationSchema.index(
  {
    user: 1,
    eventKey: 1
  },
  {
    unique: true
  }
);

notificationSchema.index({
  user: 1,
  createdAt: -1
});

notificationSchema.index({
  user: 1,
  readAt: 1
});

export const Notification = mongoose.model(
  "Notification",
  notificationSchema
);