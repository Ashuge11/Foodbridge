import { randomUUID } from "node:crypto";
import { z } from "zod";

import { Donation } from "../models/Donation.js";
import {
  DIETARY_LABELS,
  CANCELLABLE_STATUSES
} from "../constants/workflow.js";

const dateInput = z.string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const foodFields = {
  foodName: z.string().trim().min(2).max(150),
  description: z.string().trim().min(10).max(2000),
  foodType: z.enum(["raw", "cooked"]),
  quantity: z.number().finite().min(0.01).max(100000),
  unit: z.enum(["kg", "litres", "portions", "packs"]),
  estimatedServings: z.number().int().min(1).max(100000),
  preparedAt: dateInput.nullable().optional().default(null),
  expiresAt: dateInput,

  dietaryLabels: z.array(z.enum(DIETARY_LABELS))
    .max(6)
    .default([]),

  allergens: z.array(z.string().trim().min(1).max(80))
    .max(20)
    .default([]),

  storageConditions: z.string().trim().min(3).max(1000),
  pickupAddress: z.string().trim().min(5).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  safetyConfirmed: z.literal(true)
};

function checkDates(data, context) {
  if (data.expiresAt.getTime() <= Date.now()) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "The deadline must be in the future."
    });
  }

  if (data.foodType === "cooked" && !data.preparedAt) {
    context.addIssue({
      code: "custom",
      path: ["preparedAt"],
      message: "Preparation time is required for cooked food."
    });
  }

  if (
    data.preparedAt &&
    (
      data.preparedAt.getTime() > Date.now() ||
      data.preparedAt >= data.expiresAt
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["preparedAt"],
      message: "Preparation must be in the past and before the deadline."
    });
  }
}

const createSchema = z.object(foodFields)
  .strict()
  .superRefine(checkDates);

const editSchema = z.object({
  ...foodFields,
  revision: z.number().int().min(0)
}).strict().superRefine(checkDates);

const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
}).strict();

const browseSchema = z.object({
  search: z.string().trim().max(100).default(""),
  foodType: z.enum(["raw", "cooked"]).optional(),
  dietaryLabel: z.enum(DIETARY_LABELS).optional(),
  radiusKm: z.coerce.number().positive().max(100).default(15),
  minMinutes: z.coerce.number().min(0).max(43200).default(0),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional()
}).strict().superRefine((data, context) => {
  if (
    (data.latitude === undefined) !==
    (data.longitude === undefined)
  ) {
    context.addIssue({
      code: "custom",
      path: ["latitude"],
      message: "Provide both latitude and longitude."
    });
  }
});

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30)
}).strict();

function parse(schema, input) {
  const result = schema.safeParse(input);

  if (!result.success) {
    const error = new Error(
      result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")
    );

    error.statusCode = 400;
    throw error;
  }

  return result.data;
}

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function validateId(id) {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    fail(400, "Invalid donation ID.");
  }
}

function event(type, user, message, at) {
  return {
    key: randomUUID(),
    type,
    actor: user._id,
    message,
    createdAt: at,
    processedAt: null
  };
}

function listingFields(data, user, now) {
  return {
    foodName: data.foodName,
    description: data.description,
    foodType: data.foodType,
    quantity: data.quantity,
    unit: data.unit,
    estimatedServings: data.estimatedServings,
    preparedAt: data.preparedAt,
    expiresAt: data.expiresAt,
    dietaryLabels: [...new Set(data.dietaryLabels)],
    allergens: [...new Set(data.allergens)],
    storageConditions: data.storageConditions,
    pickupAddress: data.pickupAddress,

    pickupLocation: {
      type: "Point",
      coordinates: [data.longitude, data.latitude]
    },

    safetyDeclaration: {
      confirmed: true,
      declaredBy: user._id,
      declaredAt: now
    }
  };
}

function publicDocument(document) {
  const result = document.toObject();
  delete result.events;
  return result;
}

export async function createDonation(req, res, next) {
  try {
    const data = parse(createSchema, req.body);
    const now = new Date();

    const donation = await Donation.create({
      ...listingFields(data, req.user, now),
      donor: req.user._id,
      status: "available",

      history: [{
        status: "available",
        actor: req.user._id,
        note: "Donation created.",
        at: now
      }],

      events: [
        event("created", req.user, "New food donation available.", now)
      ]
    });

    res.status(201).json({
      success: true,
      donation: publicDocument(donation)
    });
  } catch (error) {
    next(error);
  }
}

export async function browseDonations(req, res, next) {
  try {
    const query = parse(browseSchema, req.query);

    const coordinates = query.latitude !== undefined
      ? [query.longitude, query.latitude]
      : req.user.location.coordinates;

    const match = {
      status: "available",
      expiresAt: {
        $gt: new Date(Date.now() + query.minMinutes * 60000)
      }
    };

    if (query.foodType) {
      match.foodType = query.foodType;
    }

    if (query.dietaryLabel) {
      match.dietaryLabels = query.dietaryLabel;
    }

    if (query.search) {
      // Escape regex characters so input is treated as literal text.
      const escaped = query.search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      match.foodName = {
        $regex: escaped,
        $options: "i"
      };
    }

    const donations = await Donation.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates
          },
          key: "pickupLocation",
          distanceField: "distanceMeters",
          maxDistance: query.radiusKm * 1000,
          spherical: true,
          query: match
        }
      },
      {
        $addFields: {
          distanceKm: {
            $round: [
              { $divide: ["$distanceMeters", 1000] },
              2
            ]
          }
        }
      },
      { $sort: { expiresAt: 1, distanceMeters: 1 } },
      { $limit: 100 },

      // Aggregations do not automatically honor select:false.
      {
        $project: {
          events: 0,
          history: 0,
          delivery: 0,
          claim: 0
        }
      }
    ]);

    res.json({
      success: true,
      donations,
      limit: 100,
      distanceLabel: "Approximate straight-line distance"
    });
  } catch (error) {
    next(error);
  }
}

export async function myDonations(req, res, next) {
  try {
    const { page, limit } = parse(pageSchema, req.query);
    let filter;

    if (req.user.role === "donor") {
      filter = { donor: req.user._id };
    } else if (req.user.role === "ngo") {
      filter = { "claim.ngo": req.user._id };
    } else if (req.user.role === "volunteer") {
      filter = { "delivery.volunteer": req.user._id };
    } else {
      filter = {};
    }

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Donation.countDocuments(filter)
    ]);

    res.json({
      success: true,
      donations,
      total,
      page,
      limit
    });
  } catch (error) {
    next(error);
  }
}

export async function editDonation(req, res, next) {
  try {
    validateId(req.params.id);
    const data = parse(editSchema, req.body);
    const now = new Date();

    // Ownership, status, expiry, and revision are checked atomically.
    const donation = await Donation.findOneAndUpdate(
      {
        _id: req.params.id,
        donor: req.user._id,
        status: "available",
        expiresAt: { $gt: now },
        revision: data.revision
      },
      {
        $set: {
          ...listingFields(data, req.user, now),
          expiryWarningFor: null
        },

        $inc: { revision: 1 },

        $push: {
          history: {
            status: "available",
            actor: req.user._id,
            note: "Listing updated.",
            at: now
          },

          events: event(
            "updated",
            req.user,
            "Food listing updated.",
            now
          )
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!donation) {
      fail(
        409,
        "Cannot edit: listing changed, expired, was claimed, or is not yours. Refresh and try again."
      );
    }

    res.json({ success: true, donation });
  } catch (error) {
    next(error);
  }
}

export async function cancelDonation(req, res, next) {
  try {
    validateId(req.params.id);
    const { reason } = parse(reasonSchema, req.body);
    const now = new Date();

    const donation = await Donation.findOneAndUpdate(
      {
        _id: req.params.id,
        donor: req.user._id,
        status: { $in: CANCELLABLE_STATUSES },
        expiresAt: { $gt: now }
      },
      {
        $set: {
          status: "cancelled",
          cancellationReason: reason
        },

        $inc: { revision: 1 },

        $push: {
          history: {
            status: "cancelled",
            actor: req.user._id,
            note: reason,
            at: now
          },

          events: event(
            "cancelled",
            req.user,
            "Donation cancelled by donor.",
            now
          )
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!donation) {
      fail(
        409,
        "Cannot cancel: listing is not yours, expired, or has already been dispatched or closed."
      );
    }

    res.json({ success: true, donation });
  } catch (error) {
    next(error);
  }
}

export async function claimDonation(req, res, next) {
  try {
    validateId(req.params.id);
    const now = new Date();

    // Only one request can change "available" to "claimed".
    const donation = await Donation.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "available",
        expiresAt: { $gt: now }
      },
      {
        $set: {
          status: "claimed",

          claim: {
            ngo: req.user._id,
            organizationName: req.user.organizationName,
            claimedAt: now,
            destinationAddress: req.user.address,

            destinationLocation: {
              type: "Point",
              coordinates: [...req.user.location.coordinates]
            }
          }
        },

        $inc: { revision: 1 },

        $push: {
          history: {
            status: "claimed",
            actor: req.user._id,
            note: "Whole listing claimed by NGO.",
            at: now
          },

          events: event(
            "claimed",
            req.user,
            "Food donation claimed by an NGO.",
            now
          )
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!donation) {
      fail(
        409,
        "Listing is unavailable, expired, cancelled, or already claimed."
      );
    }

    res.json({
      success: true,
      message: "Food claimed successfully.",
      donation
    });
  } catch (error) {
    next(error);
  }
}