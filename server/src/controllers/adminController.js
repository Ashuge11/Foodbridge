
import { z } from "zod";

import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { getImpactStats } from "../services/impactService.js";
import { ACTIVE_STATUSES } from "../constants/workflow.js";

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

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30)
}).strict();

const verificationSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  reason: z.string().trim().max(1000).optional().default("")
}).strict().superRefine((data, context) => {
  if (data.decision === "rejected" && data.reason.length < 3) {
    context.addIssue({
      code: "custom",
      path: ["reason"],
      message: "A rejection reason is required."
    });
  }
});

export async function dashboardStats(_req, res, next) {
  try {
    const now = new Date();
    const warningDeadline = new Date(now.getTime() + 60 * 60000);

    const [
      impact,
      totalUsers,
      pendingNgos,
      totalDonations,
      activeDonations,
      expiringDonations,
      statusCounts
    ] = await Promise.all([
      getImpactStats(),

      User.countDocuments(),

      User.countDocuments({
        role: "ngo",
        verificationStatus: "pending"
      }),

      Donation.countDocuments(),

      Donation.countDocuments({
        status: { $in: ACTIVE_STATUSES },
        expiresAt: { $gt: now }
      }),

      Donation.countDocuments({
        status: { $in: ACTIVE_STATUSES },
        expiresAt: {
          $gt: now,
          $lte: warningDeadline
        }
      }),

      Donation.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        ...impact,
        totalUsers,
        pendingNgos,
        totalDonations,
        activeDonations,
        expiringDonations,
        statusCounts
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req, res, next) {
  try {
    const { page, limit } = parse(paginationSchema, req.query);

    const [users, total] = await Promise.all([
      User.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      User.countDocuments()
    ]);

    // Password and tokenVersion are excluded by the User model.
    res.json({
      success: true,
      users,
      total,
      page,
      limit
    });
  } catch (error) {
    next(error);
  }
}

export async function pendingNgos(req, res, next) {
  try {
    const { page, limit } = parse(paginationSchema, req.query);

    const filter = {
      role: "ngo",
      verificationStatus: "pending"
    };

    const [ngos, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),

      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      ngos,
      total,
      page,
      limit
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyNgo(req, res, next) {
  try {
    if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
      fail(400, "Invalid NGO ID.");
    }

    const data = parse(verificationSchema, req.body);

    // Only pending applications can be reviewed by this endpoint.
    // The condition also prevents conflicting simultaneous reviews.
    const ngo = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: "ngo",
        verificationStatus: "pending"
      },
      {
        $set: {
          verificationStatus: data.decision,
          verificationReason: data.reason,
          verifiedBy: req.user._id,
          verifiedAt: new Date()
        }
      },
      {
        returnDocument: "after",
        runValidators: true
      }
    );

    if (!ngo) {
      fail(409, "NGO not found or application already reviewed.");
    }

    res.json({
      success: true,
      message:
        data.decision === "verified"
          ? "NGO approved successfully."
          : "NGO application rejected.",
      ngo
    });
  } catch (error) {
    next(error);
  }
}

async function donationPage(req, filter) {
  const { page, limit } = parse(paginationSchema, req.query);

  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .populate("donor", "name organizationName")
      .populate("claim.ngo", "name organizationName")
      .populate("delivery.volunteer", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Donation.countDocuments(filter)
  ]);

  return {
    success: true,
    donations,
    total,
    page,
    limit
  };
}

export async function listDonations(req, res, next) {
  try {
    res.json(await donationPage(req, {}));
  } catch (error) {
    next(error);
  }
}

export async function listDeliveries(req, res, next) {
  try {
    res.json(
      await donationPage(req, {
        "delivery.volunteer": {
          $exists: true,
          $ne: null
        }
      })
    );
  } catch (error) {
    next(error);
  }
}

export async function listExpiring(req, res, next) {
  try {
    const now = new Date();

    res.json(
      await donationPage(req, {
        status: { $in: ACTIVE_STATUSES },
        expiresAt: {
          $gt: now,
          $lte: new Date(now.getTime() + 60 * 60000)
        }
      })
    );
  } catch (error) {
    next(error);
  }
}