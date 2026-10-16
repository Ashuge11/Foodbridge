import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  register,
  login,
  me,
  logout
} from "../controllers/authController.js";

import { authenticate } from "../middleware/auth.js";

const router = Router();

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again after 15 minutes."
  }
});

router.post("/register", authenticationLimiter, register);
router.post("/login", authenticationLimiter, login);

router.get("/me", authenticate, me);
router.post("/logout", authenticate, logout);

export default router;