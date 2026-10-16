import { errorHandler } from "./middleware/error.js";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/authRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import { User } from "./models/User.js";
import { Donation } from "./models/Donation.js";
import { Notification } from "./models/Notification.js";

import {
  startExpiryWorker,
  stopExpiryWorker
} from "./services/expiryService.js";

import {
  startNotificationWorker,
  stopNotificationWorker
} from "./services/notificationService.js";

import {
  initializeSockets,
  closeSockets
} from "./sockets/index.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url))
});

const app = express();
// Trust Render's reverse proxy when deployed directly on Render.
if (process.env.RENDER === "true") {
  app.set("trust proxy", 1);
}
const httpServer = createServer(app);
const PORT = Number(process.env.PORT || 8080);

const allowedOrigins = (
  process.env.CLIENT_ORIGINS || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.set("query parser", "simple");
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error("This frontend origin is not allowed.");
      error.statusCode = 403;
      callback(error);
    }
  })
);

app.use(express.json({ limit: "100kb" }));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "FoodBridge backend is running."
  });
});

app.get("/api/health", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    success: connected,
    database: connected ? "connected" : "disconnected"
  });
});

// Return a recoverable error during outages rather than invalidating login.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false, message: "Database temporarily unavailable. Please try again."
    });
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

app.use(errorHandler);

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopExpiryWorker();
  stopNotificationWorker();

  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();

  try {
    // Socket.IO closes its attached HTTP server too.
    await closeSockets();

    if (httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    await mongoose.disconnect();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error("Shutdown failed:", error.message);
    process.exit(1);
  }
}

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from server/.env.");
    }

    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32
    ) {
      throw new Error(
        "JWT_SECRET must contain at least 32 characters."
      );
    }

    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
      throw new Error("PORT must be an integer from 1 to 65535.");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000
    });

    // Ensure unique and geospatial indexes exist before workers start.
    await Promise.all([
      User.init(),
      Donation.init(),
      Notification.init()
    ]);

    console.log(`MongoDB connected: ${mongoose.connection.name}`);

    initializeSockets(httpServer, allowedOrigins);

    await new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(PORT, resolve);
    });

    startExpiryWorker();
    startNotificationWorker();

    console.log(`FoodBridge API: http://localhost:${PORT}`);
    console.log("Socket.IO and notification worker are running.");

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);

    stopExpiryWorker();
    stopNotificationWorker();

    await closeSockets();
    await mongoose.disconnect();
    process.exitCode = 1;
  }
}

startServer();