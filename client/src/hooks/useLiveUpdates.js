import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function useLiveUpdates(token) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://127.0.0.1:8080",
      {
        auth: { token },
        reconnection: true
      }
    );

    let refreshTimer;

    function refreshScreens() {
      clearTimeout(refreshTimer);

      refreshTimer = setTimeout(() => {
        window.dispatchEvent(new Event("foodbridge:refresh"));
      }, 250);
    }

    socket.on("connect", () => {
      setConnected(true);
      refreshScreens();
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", () => {
      setConnected(false);
    });

    socket.on("notification", refreshScreens);
    socket.on("donation:updated", refreshScreens);

    return () => {
      clearTimeout(refreshTimer);
      socket.disconnect();
    };
  }, [token]);

  return connected;
}