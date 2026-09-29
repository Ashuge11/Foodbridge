import mongoose from "mongoose";

import {
  DIETARY_LABELS,
  DONATION_STATUSES,
  EVENT_TYPES
} from "../constants/workflow.js";

const { Schema } = mongoose;

// Shared structure for pickup and destination coordinates.
const pointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true
    },

    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            Number.isFinite(value[0]) &&
            Number.isFinite(value[1]) &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90
          );
        },
        message:
          "Coordinates must contain valid [longitude, latitude] values."
      }
    }
  },
  { _id: false }
);

// Reused for dispatch, volunteer handover, and NGO receipt.
// These fields record declarations, not a food safety guarantee.
const safetySchema = new Schema(
  {
    packaging: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    storage: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    condition: {
      type: String,
      enum: ["acceptable", "concern"],
      required: true
    },

    accepted: {
      type: Boolean,
      required: true
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    // Identity and time must be set by the backend.
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    completedByName: {
      type: String,
      required: true
    },

    completedAt: {
      type: Date,
      required: true
    }
  },
  { _id: false }
);

// A whole listing belongs to at most one claiming NGO.
const claimSchema = new Schema(
  {
    ngo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    organizationName: {
      type: String,
      required: true
    },

    claimedAt: {
      type: Date,
      required: true
    },

    // Snapshot the destination at claim time.
    destinationAddress: {
      type: String,
      required: true
    },

    destinationLocation: {
      type: pointSchema,
      required: true
    }
  },
  { _id: false }
);

const deliverySchema = new Schema(
  {
    volunteer: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    assignedAt: {
      type: Date
    },

    dispatchedAt: {
      type: Date
    },

    pickedUpAt: {
      type: Date
    },

    handoverSubmittedAt: {
      type: Date
    },

    deliveredAt: {
      type: Date
    },

    dispatchChecklist: {
      type: safetySchema,
      default: undefined
    },

    handoverChecklist: {
      type: safetySchema,
      default: undefined
    },

    receiptChecklist: {
      type: safetySchema,
      default: undefined
    }
  },
  { _id: false }
);

const historySchema = new Schema(
  {
    status: {
      type: String,
      enum: DONATION_STATUSES,
      required: true
    },

    // Automatic expiry may have no human actor.
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    note: {
      type: String,
      maxlength: 1000,
      default: ""
    },

    at: {
      type: Date,
      required: true
    }
  },
  { _id: false }
);

// Durable events are written alongside workflow changes.
// A notification worker processes events and marks them complete.
const eventSchema = new Schema(
  {
    key: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: EVENT_TYPES,
      required: true
    },

    actor: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    message: {
      type: String,
      required: true,
      maxlength: 500
    },

    createdAt: {
      type: Date,
      required: true
    },

    processedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const donationSchema = new Schema(
  {
    donor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    foodName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    foodType: {
      type: String,
      enum: ["raw", "cooked"],
      required: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.01,
      max: 100000
    },

    unit: {
      type: String,
      enum: ["kg", "litres", "portions", "packs"],
      required: true
    },

    estimatedServings: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
      validate: {
        validator: Number.isInteger,
        message: "Estimated servings must be a whole number."
      }
    },

    // API validation requires this for cooked food.
    preparedAt: {
      type: Date,
      default: null
    },

    // Workflow services must also check this on each relevant action.
    expiresAt: {
      type: Date,
      required: true
    },

    dietaryLabels: {
      type: [
        {
          type: String,
          enum: DIETARY_LABELS
        }
      ],
      default: []
    },

    allergens: {
      type: [String],
      default: []
    },

    storageConditions: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },

    pickupAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    pickupLocation: {
      type: pointSchema,
      required: true
    },

    safetyDeclaration: {
      confirmed: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true;
          },
          message: "The food safety declaration must be confirmed."
        }
      },

      declaredBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      declaredAt: {
        type: Date,
        required: true
      }
    },

    status: {
      type: String,
      enum: DONATION_STATUSES,
      default: "available",
      required: true
    },

    // Include the current revision in conditional updates.
    revision: {
      type: Number,
      default: 0,
      min: 0
    },

    claim: {
      type: claimSchema,
      default: undefined
    },

    delivery: {
      type: deliverySchema,
      default: () => ({})
    },

    cancellationReason: {
      type: String,
      maxlength: 1000,
      default: ""
    },

    rejectionReason: {
      type: String,
      maxlength: 1000,
      default: ""
    },

    expiredAt: {
      type: Date
    },

    // Tracks which deadline has already generated an expiry warning.
    expiryWarningFor: {
      type: Date,
      default: null
    },

    history: {
      type: [historySchema],
      default: []
    },

    // Internal queue: exclude from normal queries.
    events: {
      type: [eventSchema],
      default: [],
      select: false
    },

    isDemo: {
      type: Boolean,
      default: false
    },

    // Omit on ordinary donations; used by the repeatable seed script.
    seedKey: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

donationSchema.index({
  pickupLocation: "2dsphere"
});

donationSchema.index({
  status: 1,
  expiresAt: 1
});

donationSchema.index({
  donor: 1,
  createdAt: -1
});

donationSchema.index({
  "claim.ngo": 1,
  createdAt: -1
});

donationSchema.index({
  "delivery.volunteer": 1,
  createdAt: -1
});

donationSchema.index({
  "events.processedAt": 1
});

donationSchema.index(
  { seedKey: 1 },
  {
    unique: true,
    sparse: true
  }
);

export const Donation = mongoose.model("Donation", donationSchema);