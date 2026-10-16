// Roles stored in the User collection.
export const ROLES = Object.freeze([
  "donor",
  "ngo",
  "volunteer",
  "admin"
]);

// Administrator registration is not permitted publicly.
export const PUBLIC_ROLES = Object.freeze([
  "donor",
  "ngo",
  "volunteer"
]);

export const VERIFICATION_STATUSES = Object.freeze([
  "not_required",
  "pending",
  "verified",
  "rejected"
]);

export const DIETARY_LABELS = Object.freeze([
  "vegetarian",
  "vegan",
  "non-vegetarian",
  "halal",
  "jain",
  "gluten-free"
]);

export const DONATION_STATUSES = Object.freeze([
  "available",
  "claimed",
  "assigned",
  "dispatched",
  "picked_up",
  "handover_pending",
  "delivered",
  "cancelled",
  "expired",
  "rejected"
]);

export const ACTIVE_STATUSES = Object.freeze([
  "available",
  "claimed",
  "assigned",
  "dispatched",
  "picked_up",
  "handover_pending"
]);

export const TERMINAL_STATUSES = Object.freeze([
  "delivered",
  "cancelled",
  "expired",
  "rejected"
]);

// Donors can edit only unclaimed listings.
export const EDITABLE_STATUSES = Object.freeze([
  "available"
]);

// Cancellation is allowed only before dispatch.
export const CANCELLABLE_STATUSES = Object.freeze([
  "available",
  "claimed",
  "assigned"
]);

// Workflow services must additionally check ownership,
// NGO verification, volunteer availability, and expiry.
export const ACTIONS = Object.freeze({
  claim: {
    from: ["available"],
    to: "claimed",
    role: "ngo"
  },

  assign: {
    from: ["claimed"],
    to: "assigned",
    role: "volunteer"
  },

  dispatch: {
    from: ["assigned"],
    to: "dispatched",
    role: "volunteer"
  },

  pickup: {
    from: ["dispatched"],
    to: "picked_up",
    role: "volunteer"
  },

  handover: {
    from: ["picked_up"],
    to: "handover_pending",
    role: "volunteer"
  },

  receive: {
    from: ["handover_pending"],
    to: "delivered",
    role: "ngo"
  },

  cancel: {
    from: CANCELLABLE_STATUSES,
    to: "cancelled",
    role: "donor"
  }
});

export const PROGRESS_STEPS = Object.freeze([
  "available",
  "claimed",
  "assigned",
  "dispatched",
  "picked_up",
  "handover_pending",
  "delivered"
]);

export const EVENT_TYPES = Object.freeze([
  "created",
  "updated",
  "claimed",
  "assigned",
  "dispatched",
  "picked_up",
  "handover_pending",
  "delivered",
  "cancelled",
  "expired",
  "rejected",
  "expiry_warning"
]);