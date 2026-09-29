import { User } from "../models/User.js";
import { randomUUID } from "node:crypto";

import { Donation } from "../models/Donation.js";
import { Notification } from "../models/Notification.js";
import { ACTIVE_STATUSES } from "../constants/workflow.js";

import {
  findMatchingNgos,
  findMatchingVolunteers
} from "./matchingService.js";

import { emitToUser } from "../sockets/index.js";

let timer;
let running = false;

const titles = {
  created: "Food donation available",
  updated: "Food listing updated",
  claimed: "Donation claimed",
  assigned: "Volunteer assigned",
  dispatched: "Dispatch checklist recorded",
  picked_up: "Food picked up",
  handover_pending: "Handover awaiting confirmation",
  delivered: "Delivery completed",
  cancelled: "Donation cancelled",
  expired: "Donation expired",
  rejected: "Food rejected",
  expiry_warning: "Donation deadline approaching"
};
async function recipientsFor(donation, event) {
  const recipients = new Set();

  const add = (id) => {
    if (id) {
      recipients.add(String(id));
    }
  };

  // Donor and existing participants receive workflow updates.
  add(donation.donor);
  add(donation.claim?.ngo);
  add(donation.delivery?.volunteer);

  // Cancellation reaches everyone previously alerted about this donation.
  if (event.type === "cancelled") {
  const previousRecipients = await Notification.distinct("user", {
    donation: donation._id
  });

  for (const userId of previousRecipients) {
    add(userId);
  }

  const recipientUsers = await User.find({
    _id: { $in: [...recipients] }
  })
    .select("_id name role")
    .lean();

  console.log("[Cancellation notification check]", {
    donationId: String(donation._id),
    foodName: donation.foodName,
    previouslyNotifiedUserIds: previousRecipients.map(String),
    finalRecipients: recipientUsers.map((user) => ({
      id: String(user._id),
      name: user.name,
      role: user.role
    }))
  });

  return [...recipients];
}

  // A claim also alerts NGOs that previously saw the available food.
  if (event.type === "claimed") {
    const previousRecipients = await Notification.distinct("user", {
      donation: donation._id
    });

    const previousNgos = await User.find({
      _id: { $in: previousRecipients },
      role: "ngo"
    })
      .select("_id")
      .lean();
    
    console.log("[Claim alert: previously notified NGOs]", {
     donationId: String(donation._id),
     ngoIds: previousNgos.map((ngo) => String(ngo._id))
    });
    for (const ngo of previousNgos) {
      add(ngo._id);
    }
  }

  // Broadcast open listings to verified nearby NGOs.
  if (
    ["created", "updated", "expiry_warning"].includes(event.type) &&
    donation.status === "available"
  ) {
    const ngos = await findMatchingNgos(donation);

    for (const ngo of ngos) {
      add(ngo._id);
    }
  }

  // Alert available volunteers only while pickup remains unassigned.
  if (
    ["claimed", "expiry_warning"].includes(event.type) &&
    donation.status === "claimed" &&
    new Date(donation.expiresAt) > new Date()
  ) {
    const volunteers = await findMatchingVolunteers(donation);
    console.log("[Pickup alert: matching volunteers]", {
     donationId: String(donation._id),
     status: donation.status,
     volunteerIds: volunteers.map((volunteer) => String(volunteer._id))
    });
    for (const volunteer of volunteers) {
      add(volunteer._id);
    }
  }

  return [...recipients];
}
async function processEvent(donation, event) {
  const recipients = await recipientsFor(donation, event);
   console.log("[Notification recipients]", {
     donationId: String(donation._id),
     eventType: event.type,
     recipientIds: recipients
   });``
  const recipientUsers = await User.find({
    _id: { $in: recipients }
  })
    .select("_id role")
    .lean();

  const rolesById = new Map(
    recipientUsers.map((user) => [String(user._id), user.role])
  );

  const donorId = String(donation.donor);

  const claimingNgoId = donation.claim?.ngo
    ? String(donation.claim.ngo)
    : null;

  for (const userId of recipients) {
    const role = rolesById.get(userId);

    // Skip deleted accounts.
    if (!role) {
      continue;
    }

    let title = titles[event.type] || "Donation update";
    let message = `${donation.foodName}: ${event.message}`;

    if (event.type === "claimed") {
      if (userId === donorId) {
        title = "Your donation has been claimed";
        message =
          `${donation.foodName}: An NGO has reserved your donation. ` +
          "Open your donation details to track delivery.";
      } else if (userId === claimingNgoId) {
        title = "Your claim is confirmed";
        message =
          `${donation.foodName}: This donation is reserved for your NGO. ` +
          "Open My claims to check the current delivery status.";
      } else if (role === "ngo") {
        title = "Food no longer available";
        message =
          `${donation.foodName}: This food has been reserved by another NGO. ` +
          "Browse available food for other donations.";
      } else if (role === "volunteer") {
        const pickupStillOpen =
          donation.status === "claimed" &&
          new Date(donation.expiresAt) > new Date();

        title = pickupStillOpen
          ? "New pickup request available"
          : "Pickup request updated";

        message = pickupStillOpen
          ? `${donation.foodName}: An NGO has claimed this donation. ` +
            "Open nearby pickup requests to review and accept the delivery."
          : `${donation.foodName}: This pickup request is no longer open ` +
            "for acceptance. Check your delivery dashboard for its current status.";
      }
    }

    const filter = {
      user: userId,
      eventKey: event.key
    };

    try {
      await Notification.updateOne(
        filter,
        {
          $setOnInsert: {
            user: userId,
            donation: donation._id,
            eventKey: event.key,
            type: event.type,
            title,
            message,
            readAt: null
          }
        },
        {
          upsert: true,
          runValidators: true
        }
      );
    } catch (error) {
      // A concurrent worker may have already saved this notification.
      if (error.code !== 11000) {
        throw error;
      }
    }

    const notification = await Notification.findOne(filter).lean();

    if (!notification) {
      throw new Error("Notification could not be read after saving.");
    }

    await emitToUser(userId, "notification", notification);

    await emitToUser(userId, "donation:updated", {
      donationId: String(donation._id),
      eventType: event.type,
      status: donation.status
    });
  }

  // Mark the event processed only after all recipients are handled.
  await Donation.updateOne(
    {
      _id: donation._id,
      events: {
        $elemMatch: {
          key: event.key,
          processedAt: null
        }
      }
    },
    {
      $set: {
        "events.$.processedAt": new Date()
      }
    }
  );
}
async function recordExpiryWarnings() {
  const now = new Date();

  const configured = Number(
    process.env.EXPIRY_WARNING_MINUTES || 60
  );

  const warningMinutes =
    Number.isFinite(configured) && configured > 0
      ? Math.min(configured, 1440)
      : 60;

  const until = new Date(
    now.getTime() + warningMinutes * 60000
  );

  const donations = await Donation.find({
    status: { $in: ACTIVE_STATUSES },
    expiresAt: {
      $gt: now,
      $lte: until
    },
    $expr: {
      $ne: [
        { $ifNull: ["$expiryWarningFor", null] },
        "$expiresAt"
      ]
    }
  })
    .select("_id expiresAt")
    .limit(100)
    .lean();

  for (const donation of donations) {
    const at = new Date();

    // Check the deadline again, in case the donor edited the listing.
    if (donation.expiresAt <= at) {
      continue;
    }

    await Donation.updateOne(
      {
        _id: donation._id,
        status: { $in: ACTIVE_STATUSES },
        expiresAt: donation.expiresAt,
        expiryWarningFor: { $ne: donation.expiresAt }
      },
      {
        $set: {
          expiryWarningFor: donation.expiresAt
        },
        $push: {
          events: {
            key: randomUUID(),
            type: "expiry_warning",
            message:
              "The declared deadline is approaching. Check remaining time before proceeding.",
            createdAt: at,
            processedAt: null
          }
        }
      },
      {
        runValidators: true
      }
    );
  }
}

export async function processNotifications() {
  if (running) {
    return;
  }

  running = true;

  try {
    await recordExpiryWarnings();

    const donations = await Donation.find({
      events: {
        $elemMatch: {
          processedAt: null
        }
      }
    })
      .select("+events")
      .sort({ expiresAt: 1 })
      .limit(100)
      .lean();

    for (const donation of donations) {
      for (const event of donation.events || []) {
        if (event.processedAt) {
          continue;
        }

        try {
          await processEvent(donation, event);
        } catch (error) {
          // Leave the event pending for a later retry.
          console.error(
            `Notification event ${event.key} failed:`,
            error.message
          );
        }
      }
    }
  } finally {
    running = false;
  }
}

export function startNotificationWorker() {
  if (timer) {
    return;
  }

  const run = () => {
    processNotifications().catch((error) => {
      console.error("Notification worker failed:", error.message);
    });
  };

  run();
  timer = setInterval(run, 5000);
  timer.unref();
}

export function stopNotificationWorker() {
  clearInterval(timer);
  timer = undefined;
}