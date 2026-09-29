import { Router } from "express";

import {
  authenticate,
  authorize,
  requireVerifiedNgo
} from "../middleware/auth.js";

import {
  createDonation,
  browseDonations,
  myDonations,
  editDonation,
  cancelDonation,
  claimDonation
} from "../controllers/donationController.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("ngo", "admin"),
  browseDonations
);

router.get("/mine", myDonations);

router.post(
  "/",
  authorize("donor"),
  createDonation
);

router.patch(
  "/:id",
  authorize("donor"),
  editDonation
);

router.post(
  "/:id/cancel",
  authorize("donor"),
  cancelDonation
);

router.post(
  "/:id/claim",
  authorize("ngo"),
  requireVerifiedNgo,
  claimDonation
);

export default router;