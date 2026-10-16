import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";

import { User } from "./models/User.js";
import { Donation } from "./models/Donation.js";
import { Notification } from "./models/Notification.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url))
});

const DEMO_PASSWORD = "FoodBridge@123";

// Keep this fixed for repeatable seeding.
// Change to "kolhapur-v2" later if you want a fresh set of listings.
// Existing accounts and old listings will remain unchanged.
const BATCH = "kolhapur-v1";

const point = (longitude, latitude) => ({
  type: "Point",
  coordinates: [longitude, latitude]
});

async function ensureUser(data) {
  const existing = await User.findOne({ email: data.email });

  if (existing) {
    // Never reuse or modify a non-demo account accidentally.
    if (!existing.isDemo || existing.role !== data.role) {
      throw new Error(
        `Cannot use ${data.email}: an incompatible account already exists.`
      );
    }

    console.log(`Kept account: ${data.email}`);
    return existing;
  }

  // User.create runs the model's bcrypt pre-save hook.
  const user = await User.create({
    ...data,
    password: DEMO_PASSWORD,
    isDemo: true
  });

  console.log(`Created account: ${data.email}`);
  return user;
}

async function ensureDonation(seedKey, data) {
  const existing = await Donation.findOne({ seedKey });

  if (existing) {
    console.log(`Kept listing: ${existing.foodName}`);
    return existing;
  }

  const donation = await Donation.create({
    ...data,
    seedKey,
    isDemo: true
  });

  console.log(`Created listing: ${donation.foodName}`);
  return donation;
}

async function ensureNotification(data) {
  await Notification.updateOne(
    {
      user: data.user,
      eventKey: data.eventKey
    },
    {
      $setOnInsert: data
    },
    {
      upsert: true,
      runValidators: true
    }
  );
}

async function seed() {
  if (
    process.env.ALLOW_DEMO_SEED !== "true" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Use NODE_ENV=development and ALLOW_DEMO_SEED=true in server/.env."
    );
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from server/.env.");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000
  });

  // Ensure unique and geospatial indexes exist.
  await Promise.all([
    User.init(),
    Donation.init(),
    Notification.init()
  ]);

  console.log(`Connected to database: ${mongoose.connection.name}`);

  const now = new Date();
  const hoursFromNow = (hours) =>
    new Date(now.getTime() + hours * 60 * 60 * 1000);

  const admin = await ensureUser({
    name: "Demo Administrator",
    email: "admin@foodbridge.example",
    role: "admin",
    phone: "0000000000",
    address: "Demo office, Shahupuri, Kolhapur",
    location: point(74.2433, 16.7050),
    verificationStatus: "not_required"
  });

  const donor = await ensureUser({
    name: "Demo Mess Manager",
    email: "donor@foodbridge.example",
    role: "donor",
    phone: "0000000000",
    organizationName: "Demo Campus Kitchen",
    address: "Demo pickup point, Kasaba Bawada, Kolhapur",
    location: point(74.2530, 16.7280),
    verificationStatus: "not_required"
  });

  const ngo = await ensureUser({
    name: "Demo NGO Coordinator",
    email: "ngo@foodbridge.example",
    role: "ngo",
    phone: "0000000000",
    organizationName: "Demo Kolhapur Community Shelter",
    registrationNumber: "DEMO-NGO-001",
    organizationDescription:
      "Fictional shelter account for demonstrating food redistribution.",
    address: "Demo shelter point, Shahupuri, Kolhapur",
    location: point(74.2433, 16.7050),
    verificationStatus: "verified",
    verificationReason: "Approved only for hackathon demonstration.",
    verifiedBy: admin._id,
    verifiedAt: now
  });

  const pendingNgo = await ensureUser({
    name: "Demo Pending NGO Coordinator",
    email: "pending@foodbridge.example",
    role: "ngo",
    phone: "0000000000",
    organizationName: "Demo Rankala Support Centre",
    registrationNumber: "DEMO-NGO-002",
    organizationDescription:
      "Fictional pending NGO account for testing administrator approval.",
    address: "Demo centre, Rankala area, Kolhapur",
    location: point(74.2110, 16.6940),
    verificationStatus: "pending"
  });

  const volunteer1 = await ensureUser({
    name: "Demo Volunteer One",
    email: "volunteer1@foodbridge.example",
    role: "volunteer",
    phone: "0000000000",
    address: "Demo volunteer point, Tarabai Park, Kolhapur",
    location: point(74.2520, 16.7140),
    verificationStatus: "not_required",
    available: true
  });

  const volunteer2 = await ensureUser({
    name: "Demo Volunteer Two",
    email: "volunteer2@foodbridge.example",
    role: "volunteer",
    phone: "0000000000",
    address: "Demo volunteer point, Rajarampuri, Kolhapur",
    location: point(74.2510, 16.6900),
    verificationStatus: "not_required",
    available: true
  });

  const common = {
    donor: donor._id,
    pickupAddress: donor.address,
    pickupLocation: donor.location.toObject(),
    safetyDeclaration: {
      confirmed: true,
      declaredBy: donor._id,
      declaredAt: now
    }
  };

  const rice = await ensureDonation(`${BATCH}-rice`, {
    ...common,
    foodName: "[DEMO] Vegetable Rice",
    description:
      "Fictional surplus vegetable rice listing for testing claims and pickup.",
    foodType: "cooked",
    quantity: 12,
    unit: "kg",
    estimatedServings: 40,
    preparedAt: hoursFromNow(-1),
    expiresAt: hoursFromNow(4),
    dietaryLabels: ["vegetarian"],
    allergens: ["Milk"],
    storageConditions:
      "Demo declaration: held in covered food-grade containers.",
    status: "available",
    history: [
      {
        status: "available",
        actor: donor._id,
        note: "Demo listing created.",
        at: now
      }
    ]
  });

  const vegetables = await ensureDonation(`${BATCH}-vegetables`, {
    ...common,
    foodName: "[DEMO] Mixed Raw Vegetables",
    description:
      "Fictional surplus potatoes, carrots, and cabbage for a shelter kitchen.",
    foodType: "raw",
    quantity: 20,
    unit: "kg",
    estimatedServings: 65,
    preparedAt: null,
    expiresAt: hoursFromNow(24),
    dietaryLabels: ["vegan", "vegetarian"],
    allergens: [],
    storageConditions:
      "Demo declaration: stored in clean ventilated crates.",
    status: "available",
    history: [
      {
        status: "available",
        actor: donor._id,
        note: "Demo listing created.",
        at: now
      }
    ]
  });

  const urgent = await ensureDonation(`${BATCH}-urgent`, {
    ...common,
    foodName: "[DEMO] Chapati Packs — Urgent Pickup",
    description:
      "Fictional listing with a short deadline for testing expiry alerts.",
    foodType: "cooked",
    quantity: 15,
    unit: "packs",
    estimatedServings: 30,
    preparedAt: hoursFromNow(-1),
    expiresAt: hoursFromNow(0.75),
    dietaryLabels: ["vegetarian"],
    allergens: ["Wheat", "Gluten"],
    storageConditions:
      "Demo declaration: packed in covered food-grade boxes.",
    status: "available",
    history: [
      {
        status: "available",
        actor: donor._id,
        note: "Urgent demo listing created.",
        at: now
      }
    ]
  });

  // A completed example populates claim, delivery, safety, and history fields.
  const checklist = (person, completedAt, notes) => ({
    packaging: "Demo declaration: containers were sealed.",
    storage: "Demo declaration: containers were kept covered.",
    condition: "acceptable",
    accepted: true,
    reason: "",
    notes,
    completedBy: person._id,
    completedByName: person.name,
    completedAt
  });

  const completed = await ensureDonation(`${BATCH}-completed`, {
    ...common,
    foodName: "[DEMO] Completed Meal Donation",
    description:
      "Fictional completed donation for demonstrating delivery history and impact.",
    foodType: "cooked",
    quantity: 25,
    unit: "portions",
    estimatedServings: 25,
    preparedAt: hoursFromNow(-5),
    expiresAt: hoursFromNow(-1),
    dietaryLabels: ["vegetarian"],
    allergens: ["Milk", "Wheat"],
    storageConditions:
      "Demo declaration: meals were packed before collection.",
    safetyDeclaration: {
      confirmed: true,
      declaredBy: donor._id,
      declaredAt: hoursFromNow(-4.5)
    },
    status: "delivered",
    revision: 6,
    claim: {
      ngo: ngo._id,
      organizationName: ngo.organizationName,
      claimedAt: hoursFromNow(-4),
      destinationAddress: ngo.address,
      destinationLocation: ngo.location.toObject()
    },
    delivery: {
      volunteer: volunteer1._id,
      assignedAt: hoursFromNow(-3.8),
      dispatchedAt: hoursFromNow(-3.5),
      pickedUpAt: hoursFromNow(-3.4),
      handoverSubmittedAt: hoursFromNow(-3),
      deliveredAt: hoursFromNow(-2.9),
      dispatchChecklist: checklist(
        volunteer1,
        hoursFromNow(-3.5),
        "Demo dispatch recorded."
      ),
      handoverChecklist: checklist(
        volunteer1,
        hoursFromNow(-3),
        "Demo handover submitted."
      ),
      receiptChecklist: checklist(
        ngo,
        hoursFromNow(-2.9),
        "Demo NGO accepted 25 portions."
      )
    },
    history: [
      {
        status: "available",
        actor: donor._id,
        note: "Demo listing created.",
        at: hoursFromNow(-4.5)
      },
      {
        status: "claimed",
        actor: ngo._id,
        note: "Demo NGO claimed the listing.",
        at: hoursFromNow(-4)
      },
      {
        status: "assigned",
        actor: volunteer1._id,
        note: "Demo volunteer assigned.",
        at: hoursFromNow(-3.8)
      },
      {
        status: "dispatched",
        actor: volunteer1._id,
        note: "Demo dispatch checklist accepted.",
        at: hoursFromNow(-3.5)
      },
      {
        status: "picked_up",
        actor: volunteer1._id,
        note: "Demo pickup recorded.",
        at: hoursFromNow(-3.4)
      },
      {
        status: "handover_pending",
        actor: volunteer1._id,
        note: "Demo handover submitted.",
        at: hoursFromNow(-3)
      },
      {
        status: "delivered",
        actor: ngo._id,
        note: "Demo receipt accepted.",
        at: hoursFromNow(-2.9)
      }
    ]
  });

  // Sample persistent notifications. No Socket.IO server is needed to seed.
  const notifications = [
    {
      user: admin._id,
      eventKey: `${BATCH}-pending-ngo`,
      type: "verification",
      title: "[DEMO] NGO awaiting verification",
      message: `${pendingNgo.organizationName} is awaiting review.`
    },
    {
      user: ngo._id,
      donation: rice._id,
      eventKey: `${BATCH}-rice-match`,
      type: "created",
      title: "[DEMO] Food available nearby",
      message: "A vegetable rice demo listing is available near your shelter."
    },
    {
      user: donor._id,
      donation: completed._id,
      eventKey: `${BATCH}-delivery-complete`,
      type: "delivered",
      title: "[DEMO] Delivery completed",
      message: "The demo NGO confirmed receipt of 25 estimated servings."
    },
    {
      user: volunteer1._id,
      donation: completed._id,
      eventKey: `${BATCH}-volunteer-complete`,
      type: "delivered",
      title: "[DEMO] Delivery history ready",
      message: "Your completed demo delivery is available in history."
    },
    {
      user: volunteer2._id,
      eventKey: `${BATCH}-volunteer-welcome`,
      type: "welcome",
      title: "[DEMO] Volunteer account ready",
      message: "Your demo account is available for nearby pickup requests."
    },
    {
      user: pendingNgo._id,
      eventKey: `${BATCH}-verification-pending`,
      type: "verification",
      title: "[DEMO] Verification pending",
      message: "Administrator approval is required before you can claim food."
    }
  ];

  for (const notification of notifications) {
    await ensureNotification(notification);
  }

  const counts = await Promise.all([
    User.countDocuments({ isDemo: true }),
    Donation.countDocuments({ isDemo: true }),
    Notification.countDocuments({
      eventKey: { $in: notifications.map((item) => item.eventKey) }
    })
  ]);

  console.log("\nSeed completed successfully.");
  console.table({
    demoUsers: counts[0],
    demoDonations: counts[1],
    batchNotifications: counts[2]
  });

  console.log("Collections: users, donations, notifications");
  console.log(`Password for newly created demo accounts: ${DEMO_PASSWORD}`);
  console.log("Existing account passwords were not changed.");

  console.table([
    { role: "Admin", email: admin.email },
    { role: "Donor", email: donor.email },
    { role: "Verified NGO", email: ngo.email },
    { role: "Pending NGO", email: pendingNgo.email },
    { role: "Volunteer 1", email: volunteer1.email },
    { role: "Volunteer 2", email: volunteer2.email }
  ]);

  console.log(
    `Available demo listing IDs: ${rice._id}, ${vegetables._id}, ${urgent._id}`
  );
}

seed()
  .catch((error) => {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });