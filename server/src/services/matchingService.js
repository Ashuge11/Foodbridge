import { User } from "../models/User.js";

function radiusMeters() {
  const configured = Number(process.env.MATCH_RADIUS_KM || 15);

  const radiusKm =
    Number.isFinite(configured) && configured > 0
      ? Math.min(configured, 100)
      : 15;

  return radiusKm * 1000;
}

async function nearbyUsers(location, filter) {
  return User.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [...location.coordinates]
        },
        key: "location",
        distanceField: "distanceMeters",
        maxDistance: radiusMeters(),
        spherical: true,
        query: filter
      }
    },
    {
      $sort: {
        distanceMeters: 1
      }
    },
    {
      $project: {
        _id: 1,
        distanceKm: {
          $round: [
            { $divide: ["$distanceMeters", 1000] },
            2
          ]
        }
      }
    }
  ]);
}

export async function findMatchingNgos(donation) {
  if (
    donation.status !== "available" ||
    new Date(donation.expiresAt).getTime() <= Date.now()
  ) {
    return [];
  }

  return nearbyUsers(donation.pickupLocation, {
    role: "ngo",
    verificationStatus: "verified"
  });
}

export async function findMatchingVolunteers(donation) {
  if (
    donation.status !== "claimed" ||
    new Date(donation.expiresAt).getTime() <= Date.now()
  ) {
    return [];
  }

  return nearbyUsers(donation.pickupLocation, {
    role: "volunteer",
    available: true
  });
}