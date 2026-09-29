
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";

function fail(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function parse(schema, input) {
  const result = schema.safeParse(input);

  if (!result.success) {
    fail(
      400,
      result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")
    );
  }

  return result.data;
}

function validateId(id) {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    fail(400, "Invalid donation ID.");
  }
}

const availabilitySchema = z.object({
  available: z.boolean(),
  address: z.string().trim().min(5).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180)
}).strict();

const nearbySchema = z.object({
  radiusKm: z.coerce.number().positive().max(100).default(15)
}).strict();

const checklistSchema = z.object({
  packaging: z.string().trim().min(3).max(500),
  storage: z.string().trim().min(3).max(500),
  condition: z.enum(["acceptable", "concern"]),
  accepted: z.boolean(),
  reason: z.string().trim().max(1000).optional().default(""),
  notes: z.string().trim().max(1000).optional().default("")
}).strict().superRefine((data, context) => {
  if (!data.accepted && data.reason.length < 3) {
    context.addIssue({
      code: "custom",
      path: ["reason"],
      message: "Provide a rejection reason."
    });
  }

  if (data.accepted && data.condition !== "acceptable") {
    context.addIssue({
      code: "custom",
      path: ["condition"],
      message: "Food with a condition concern cannot be accepted."
    });
  }
});

// Each action checks the expected status and participant atomically.
// Only one competing request can perform the same transition.
async function transition({
  req,
  from,
  to,
  participantField,
  fields = {},
  note
}) {
  validateId(req.params.id);
  const now = new Date();

  const filter = {
    _id: req.params.id,
    status: from,
    expiresAt: { $gt: now }
  };

  if (participantField) {
    filter[participantField] = req.user._id;
  }

  const donation = await Donation.findOneAndUpdate(
    filter,
    {
      $set: {
        ...fields,
        status: to
      },

      $inc: { revision: 1 },

      $push: {
        history: {
          status: to,
          actor: req.user._id,
          note,
          at: now
        },

        events: {
          key: randomUUID(),
          type: to,
          actor: req.user._id,
          message: note,
          createdAt: now,
          processedAt: null
        }
      }
    },
    {
      returnDocument: "after",
      runValidators: true
    }
  );

  if (!donation) {
    fail(
      409,
      "Action unavailable: donation expired, its status changed, or you are not its assigned participant."
    );
  }

  return donation;
}

export async function updateAvailability(req, res, next) {
  try {
    const data = parse(availabilitySchema, req.body);

    const user = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        role: "volunteer"
      },
      {
        $set: {
          available: data.available,
          address: data.address,
          location: {
            type: "Point",
            coordinates: [data.longitude, data.latitude]
          }
        }
      },
      {
        returnDocument: "after",
        runValidators: true
      }
    );

    if (!user) {
      fail(404, "Volunteer account not found.");
    }

    res.json({
      success: true,
      message: "Availability and location updated.",
      user
    });
  } catch (error) {
    next(error);
  }
}

export async function nearbyRequests(req, res, next) {
  try {
    const { radiusKm } = parse(nearbySchema, req.query);

    if (!req.user.available) {
      return res.json({
        success: true,
        deliveries: [],
        message: "Set yourself as available to view pickup requests."
      });
    }

    const deliveries = await Donation.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [...req.user.location.coordinates]
          },
          key: "pickupLocation",
          distanceField: "distanceMeters",
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: {
             status: "claimed",
             expiresAt: { $gt: new Date() },

         // A receiving NGO and destination must already be recorded.
         "claim.ngo": { $type: "objectId" },
         "claim.destinationAddress": { $regex: /\S/ },
         "claim.destinationLocation.type": "Point",
         "claim.destinationLocation.coordinates.0": {
            $type: "number",
            $gte: -180,
           $lte: 180
        },
       "claim.destinationLocation.coordinates.1": {
          $type: "number",
          $gte: -90,
          $lte: 90
       },

       // Only requests without an assigned volunteer.
       "delivery.volunteer": null
 }
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
      { $project: { events: 0, history: 0 } }
    ]);

    res.json({
      success: true,
      deliveries,
      distanceLabel: "Approximate straight-line distance"
    });
  } catch (error) {
    next(error);
  }
}

export async function getDelivery(req, res, next) {
  try {
    validateId(req.params.id);

    const filter = { _id: req.params.id };

    // Detailed delivery data is visible only to participants or an admin.
    if (req.user.role !== "admin") {
      filter.$or = [
        { donor: req.user._id },
        { "claim.ngo": req.user._id },
        { "delivery.volunteer": req.user._id }
      ];
    }

    const donation = await Donation.findOne(filter)
      .populate("donor", "name organizationName phone")
      .populate("claim.ngo", "name organizationName phone")
      .populate("delivery.volunteer", "name phone");

    if (!donation) {
      fail(404, "Delivery not found or access is not permitted.");
    }

    res.json({ success: true, donation });
  } catch (error) {
    next(error);
  }
}

export async function acceptDelivery(req, res, next) {
  try {
    validateId(req.params.id);

    if (!req.user.available) {
      fail(403, "Set your availability before accepting a delivery.");
    }

    const now = new Date();

    // Conditional update prevents two volunteers accepting this listing.
    const donation = await Donation.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "claimed",
        expiresAt: { $gt: now },
        "delivery.volunteer": null
      },
      {
        $set: {
          status: "assigned",
          "delivery.volunteer": req.user._id,
          "delivery.assignedAt": now
        },

        $inc: { revision: 1 },

        $push: {
          history: {
            status: "assigned",
            actor: req.user._id,
            note: "Volunteer accepted delivery.",
            at: now
          },

          events: {
            key: randomUUID(),
            type: "assigned",
            actor: req.user._id,
            message: "A volunteer accepted the delivery.",
            createdAt: now,
            processedAt: null
          }
        }
      },
      {
        returnDocument: "after",
        runValidators: true
      }
    );

    if (!donation) {
      fail(
        409,
        "This request expired, changed status, or already has a volunteer."
      );
    }

    res.json({
      success: true,
      message: "Delivery assigned to you.",
      donation
    });
  } catch (error) {
    next(error);
  }
}

// Builds handlers for the three checklist stages.
function checklistAction({
  from,
  to,
  participantField,
  checklistField,
  timestampField,
  successNote
}) {
  return async (req, res, next) => {
    try {
      const data = parse(checklistSchema, req.body);
      const now = new Date();

      const fields = {
        [checklistField]: {
          ...data,
          completedBy: req.user._id,
          completedByName: req.user.name,
          completedAt: now
        }
      };

      if (data.accepted) {
        fields[timestampField] = now;
      } else {
        fields.rejectionReason = data.reason;
      }

      const donation = await transition({
        req,
        from,
        to: data.accepted ? to : "rejected",
        participantField,
        fields,
        note: data.accepted
          ? successNote
          : `Food rejected: ${data.reason}`
      });

      res.json({
        success: true,
        message: data.accepted
          ? successNote
          : "Rejection recorded. Delivery stopped.",
        donation
      });
    } catch (error) {
      next(error);
    }
  };
}

export const recordDispatch = checklistAction({
  from: "assigned",
  to: "dispatched",
  participantField: "delivery.volunteer",
  checklistField: "delivery.dispatchChecklist",
  timestampField: "delivery.dispatchedAt",
  successNote: "Dispatch checklist accepted."
});

export async function recordPickup(req, res, next) {
  try {
    const donation = await transition({
      req,
      from: "dispatched",
      to: "picked_up",
      participantField: "delivery.volunteer",
      fields: {
        "delivery.pickedUpAt": new Date()
      },
      note: "Volunteer confirmed food pickup."
    });

    res.json({ success: true, donation });
  } catch (error) {
    next(error);
  }
}

export const submitHandover = checklistAction({
  from: "picked_up",
  to: "handover_pending",
  participantField: "delivery.volunteer",
  checklistField: "delivery.handoverChecklist",
  timestampField: "delivery.handoverSubmittedAt",
  successNote: "Handover submitted. Awaiting NGO confirmation."
});

export const confirmReceipt = checklistAction({
  from: "handover_pending",
  to: "delivered",
  participantField: "claim.ngo",
  checklistField: "delivery.receiptChecklist",
  timestampField: "delivery.deliveredAt",
  successNote: "NGO confirmed receipt. Delivery completed."
});