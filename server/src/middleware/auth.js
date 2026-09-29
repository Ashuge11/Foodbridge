import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "Add a JWT_SECRET of at least 32 characters to server/.env."
    );
  }

  return secret;
}

export function createToken(user) {
  return jwt.sign(
    {
      tokenVersion: user.tokenVersion ?? 0
    },
    getSecret(),
    {
      algorithm: "HS256",
      subject: user._id.toString(),
      issuer: "foodbridge-api",
      audience: "foodbridge-web",
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    }
  );
}

export async function authenticateToken(token) {
  if (typeof token !== "string" || token.length > 4096) {
    throw new Error("Invalid token.");
  }

  const payload = jwt.verify(token, getSecret(), {
    algorithms: ["HS256"],
    issuer: "foodbridge-api",
    audience: "foodbridge-web"
  });

  if (
    typeof payload !== "object" ||
    !/^[a-fA-F0-9]{24}$/.test(payload.sub || "") ||
    !Number.isInteger(payload.tokenVersion) ||
    !Number.isFinite(payload.exp)
  ) {
    throw new Error("Invalid token.");
  }

  const user = await User.findById(payload.sub)
    .select("+tokenVersion");

  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw new Error("Session has ended.");
  }

  return {
    user,
    expiresAt: payload.exp * 1000
  };
}

export async function authenticate(req, res, next) {
  const [scheme, token, extra] = (
    req.headers.authorization || ""
  ).split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    return res.status(401).json({
      success: false,
      message: "Please log in to continue."
    });
  }

  try {
    const session = await authenticateToken(token);
    req.user = session.user;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Session invalid or expired. Please log in again."
    });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission for this action."
      });
    }

    next();
  };
}

export function requireVerifiedNgo(req, res, next) {
  if (
    req.user?.role !== "ngo" ||
    req.user.verificationStatus !== "verified"
  ) {
    return res.status(403).json({
      success: false,
      message: "Administrator verification is required to claim food."
    });
  }

  next();
}