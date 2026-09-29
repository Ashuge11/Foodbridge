import { Router } from "express";

import {
  authenticate,
  authorize
} from "../middleware/auth.js";

import {
  dashboardStats,
  listUsers,
  pendingNgos,
  verifyNgo,
  listDonations,
  listDeliveries,
  listExpiring
} from "../controllers/adminController.js";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get("/stats", dashboardStats);
router.get("/users", listUsers);

router.get("/ngos/pending", pendingNgos);
router.patch("/ngos/:id/verify", verifyNgo);

router.get("/donations", listDonations);
router.get("/deliveries", listDeliveries);
router.get("/expiring", listExpiring);

export default router;