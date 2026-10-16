export { authorize } from "./auth.js";

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  let status = Number(error.statusCode || error.status || 500);
  if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;
  let message = error.message || "Request failed.";
  let details = error.details;
  if (error.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON request body.";
  } else if (error.type === "entity.too.large") {
    status = 413;
    message = "Request is too large. Maximum JSON size is 100 KB.";
  } else if (error.code === 11000) {
    status = 409;
    message = "A record with these unique values already exists.";
  } else if (error.name === "ZodError") {
    status = 400;
    message = "Please check the submitted values.";
    details = error.issues.map(i => ({ field: i.path.join("."), message: i.message }));
  } else if (error.name === "ValidationError") {
    status = 400;
    message = "Please check the submitted values.";
    details = Object.values(error.errors).map(i => ({
      field: i.path, message: i.message
    }));
  } else if (error.name === "CastError") {
    status = 400;
    message = "Invalid record ID or field value.";
  } else if (["MongoServerSelectionError", "MongooseServerSelectionError",
    "MongoNetworkError", "MongoNotConnectedError"].includes(error.name)) {
    status = 503;
    message = "Database temporarily unavailable. Please try again.";
  }
  if (status >= 500) {
    console.error("Request failed:", error.name);
    if (status !== 503) message = "An internal server error occurred.";
    details = undefined;
  }
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
}
