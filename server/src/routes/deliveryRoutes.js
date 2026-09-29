import { Router } from "express";

import {
  authenticate,
  authorize
} from "../middleware/auth.js";

import {
  updateAvailability,
  nearbyRequests,
  getDelivery,
  acceptDelivery,
  recordDispatch,
  recordPickup,
  submitHandover,
  confirmReceipt
} from "../controllers/deliveryController.js";

import { getImpactStats } from "../services/impactService.js";

const router = Router();

router.get("/impact", async (_req, res, next) => {
  try {
    res.json({
      success: true,
      stats: await getImpactStats()
    });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.patch(
  "/availability",
  authorize("volunteer"),
  updateAvailability
);

router.get(
  "/requests",
  authorize("volunteer"),
  nearbyRequests
);

router.get("/:id", getDelivery);

router.post(
  "/:id/accept",
  authorize("volunteer"),
  acceptDelivery
);

router.post(
  "/:id/dispatch",
  authorize("volunteer"),
  recordDispatch
);

router.post(
  "/:id/pickup",
  authorize("volunteer"),
  recordPickup
);

router.post(
  "/:id/handover",
  authorize("volunteer"),
  submitHandover
);

router.post(
  "/:id/receive",
  authorize("ngo"),
  confirmReceipt
);

export default router;