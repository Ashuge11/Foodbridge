import { disconnectUserSockets } from "../sockets/index.js";
import { z } from "zod";

import { User } from "../models/User.js";
import { createToken } from "../middleware/auth.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),

  email: z.string()
    .trim()
    .email()
    .max(254)
    .toLowerCase(),

  password: z.string()
    .min(8)
    .max(72)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must not exceed 72 UTF-8 bytes."
    ),

  role: z.enum(["donor", "ngo", "volunteer"]),

  phone: z.string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number."),

  address: z.string().trim().min(5).max(500),

  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),

  organizationName: z.string()
    .trim()
    .max(150)
    .optional()
    .default(""),

  registrationNumber: z.string()
    .trim()
    .max(100)
    .optional()
    .default(""),

  organizationDescription: z.string()
    .trim()
    .max(1000)
    .optional()
    .default("")
}).strict().superRefine((data, context) => {
  if (data.role !== "ngo") {
    return;
  }

  const requirements = [
    ["organizationName", 2, "Organization name is required."],
    ["registrationNumber", 2, "Registration reference is required."],
    [
      "organizationDescription",
      10,
      "Describe your organization in at least 10 characters."
    ]
  ];

  for (const [field, minimum, message] of requirements) {
    if (data[field].length < minimum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message
      });
    }
  }
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(1).max(200)
}).strict();

function validateBody(schema, body, res) {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Please check the submitted values.",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });

    return null;
  }

  return result.data;
}

export async function register(req, res, next) {
  try {
    const data = validateBody(registerSchema, req.body, res);

    if (!data) {
      return;
    }

    const existing = await User.exists({ email: data.email });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered."
      });
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
      phone: data.phone,
      address: data.address,
      organizationName: data.organizationName,
      registrationNumber: data.registrationNumber,
      organizationDescription: data.organizationDescription,

      location: {
        type: "Point",
        coordinates: [data.longitude, data.latitude]
      },

      // Never accept verification fields from the browser.
      verificationStatus:
        data.role === "ngo" ? "pending" : "not_required",

      available: false
    });

    res.status(201).json({
      success: true,
      message:
        user.role === "ngo"
          ? "Account created. NGO verification is pending."
          : "Account created successfully.",
      token: createToken(user),
      user: user.toJSON()
    });
  } catch (error) {
    // Handles simultaneous registrations with the same email.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered."
      });
    }

    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const data = validateBody(loginSchema, req.body, res);

    if (!data) {
      return;
    }

    const user = await User.findOne({
      email: data.email
    }).select("+password +tokenVersion");

    if (!user || !(await user.comparePassword(data.password))) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password."
      });
    }

    res.json({
      success: true,
      message: "Logged in successfully.",
      token: createToken(user),
      user: user.toJSON()
    });
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  res.json({
    success: true,
    user: req.user.toJSON()
  });
}

export async function logout(req, res, next) {
  try {
    // Invalidate the user's existing login tokens.
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { tokenVersion: 1 } }
    );

    // Disconnect the user's live notification connections.
    disconnectUserSockets(req.user._id);

    res.json({
      success: true,
      message: "Logged out successfully."
    });
  } catch (error) {
    next(error);
  }
}