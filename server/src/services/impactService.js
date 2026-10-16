import { Donation } from "../models/Donation.js";

export async function getImpactStats() {
  const [result] = await Donation.aggregate([
    {
      $match: {
        status: "delivered"
      }
    },
    {
      $group: {
        _id: null,

        completedDonations: {
          $sum: 1
        },

        estimatedServingsDelivered: {
          $sum: "$estimatedServings"
        },

        demoCompletedDonations: {
          $sum: {
            $cond: [{ $eq: ["$isDemo", true] }, 1, 0]
          }
        },

        demoEstimatedServings: {
          $sum: {
            $cond: [
              { $eq: ["$isDemo", true] },
              "$estimatedServings",
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0
      }
    }
  ]);

  return result || {
    completedDonations: 0,
    estimatedServingsDelivered: 0,
    demoCompletedDonations: 0,
    demoEstimatedServings: 0
  };
}