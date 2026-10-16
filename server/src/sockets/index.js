import { Server } from "socket.io";
import { authenticateToken } from "../middleware/auth.js";

let io;

function userRoom(userId) {
  return `user:${userId.toString()}`;
}

export function initializeSockets(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"]
    },

    // Also enforce origin restrictions for WebSocket upgrades.
    allowRequest(request, callback) {
      const origin = request.headers.origin;

      callback(
        null,
        !origin || allowedOrigins.includes(origin)
      );
    },

    maxHttpBufferSize: 100000
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const session = await authenticateToken(token);

      socket.data.userId = session.user._id.toString();
      socket.data.token = token;
      socket.data.expiresAt = session.expiresAt;

      next();
    } catch {
      next(new Error("Please log in again."));
    }
  });

  io.on("connection", (socket) => {
    // The server chooses the room. Clients cannot join other users' rooms.
    socket.join(userRoom(socket.data.userId));

    const expiryTimer = setTimeout(() => {
      socket.disconnect(true);
    }, Math.min(
      Math.max(socket.data.expiresAt - Date.now(), 0),
      2147483647
    ));

    expiryTimer.unref?.();

    socket.on("disconnect", () => {
      clearTimeout(expiryTimer);
    });
  });

  return io;
}

export async function emitToUser(userId, eventName, payload) {
  if (!io) {
    return;
  }

  const sockets = await io.in(userRoom(userId)).fetchSockets();

  for (const socket of sockets) {
    try {
      // Recheck token validity before sending private information.
      await authenticateToken(socket.data.token);
    } catch {
      socket.disconnect(true);
      continue;
    }

    socket.emit(eventName, payload);
  }
}

export function disconnectUserSockets(userId) {
  io?.in(userRoom(userId)).disconnectSockets(true);
}

export async function closeSockets() {
  if (!io) {
    return;
  }

  await new Promise((resolve) => io.close(resolve));
  io = undefined;
}