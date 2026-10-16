import { randomUUID } from "node:crypto";

import { Donation } from "../models/Donation.js";
import { ACTIVE_STATUSES } from "../constants/workflow.js";

let timer;
let running = false;

export async function expireDonations() {
  if (running) {
    return;
  }

  running = true;

  try {
    const now = new Date();

    const candidates = await Donation.find({
      status: { $in: ACTIVE_STATUSES },
      expiresAt: { $lte: now }
    })
      .select("_id")
      .limit(200)
      .lean();

    for (const candidate of candidates) {
      // Recheck status and deadline in the write itself.
      await Donation.updateOne(
        {
          _id: candidate._id,
          status: { $in: ACTIVE_STATUSES },
          expiresAt: { $lte: now }
        },
        {
          $set: {
            status: "expired",
            expiredAt: now
          },

          $inc: { revision: 1 },

          $push: {
            history: {
              status: "expired",
              note: "Donor-declared deadline passed.",
              at: now
            },

            events: {
              key: randomUUID(),
              type: "expired",
              message: "Donation deadline passed.",
              createdAt: now,
              processedAt: null
            }
          }
        },
        {
          runValidators: true
        }
      );
    }
  } finally {
    running = false;
  }
}

export function startExpiryWorker() {
  if (timer) {
    return;
  }

  const run = () => {
    expireDonations().catch((error) => {
      console.error("Expiry check failed:", error.message);
    });
  };

  run();
  timer = setInterval(run, 30000);
  timer.unref();
}

export function stopExpiryWorker() {
  clearInterval(timer);
  timer = undefined;
}