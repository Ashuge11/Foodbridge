import mongoose from "mongoose";
import bcrypt from "bcrypt";

import {
  ROLES,
  VERIFICATION_STATUSES
} from "../constants/workflow.js";

const { Schema } = mongoose;

// MongoDB coordinates must be [longitude, latitude].
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

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },

    // The pre-save hook replaces the plain password with its bcrypt hash.
    password: {
      type: String,
      required: [true, "Password is required."],
      select: false
    },

    // Public registration validation must exclude "admin".
    role: {
      type: String,
      enum: ROLES,
      required: [true, "Role is required."]
    },

    phone: {
      type: String,
      required: [true, "Phone number is required."],
      trim: true,
      maxlength: 20
    },

    organizationName: {
      type: String,
      trim: true,
      maxlength: 150,
      default: ""
    },

    registrationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ""
    },

    organizationDescription: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    address: {
      type: String,
      required: [true, "Address is required."],
      trim: true,
      maxlength: 500
    },

    location: {
      type: pointSchema,
      required: [true, "Location is required."]
    },

    // The registration controller sets this to "pending" for NGOs.
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "not_required"
    },

    verificationReason: {
      type: String,
      maxlength: 1000,
      default: ""
    },

    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },

    verifiedAt: {
      type: Date
    },

    available: {
      type: Boolean,
      default: false
    },

    // Increment on logout to invalidate previously issued JWTs.
    tokenVersion: {
      type: Number,
      default: 0,
      select: false
    },

    isDemo: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,

    toJSON: {
      transform(_document, returned) {
        delete returned.password;
        delete returned.tokenVersion;
        delete returned.__v;

        return returned;
      }
    }
  }
);

// Supports nearby NGO and volunteer searches.
userSchema.index({ location: "2dsphere" });

userSchema.index({
  role: 1,
  verificationStatus: 1
});

userSchema.index({
  role: 1,
  available: 1
});

// Use document.save() when creating or changing a password.
// findOneAndUpdate() does not execute this save hook.
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", userSchema);