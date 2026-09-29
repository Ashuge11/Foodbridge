import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import { api, TOKEN_KEY } from "../api/http";
import useLiveUpdates from "../hooks/useLiveUpdates";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || ""
  );

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const connected = useLiveUpdates(user ? token : "");

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setSessionError("");
  }

  useEffect(() => {
    window.addEventListener(
      "foodbridge:unauthorized",
      clearSession
    );

    return () => {
      window.removeEventListener(
        "foodbridge:unauthorized",
        clearSession
      );
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setSessionError("");

      try {
        const result = await api("/auth/me", { token });

        if (active) {
          setUser(result.user);
        }
      } catch (error) {
        if (active && error.status !== 401) {
          setSessionError(error.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, [token]);

  async function authenticate(path, values) {
    const result = await api(path, {
      method: "POST",
      body: values
    });

    sessionStorage.setItem(TOKEN_KEY, result.token);
    setUser(result.user);
    setToken(result.token);
    setSessionError("");

    return result.user;
  }

  async function login(values) {
    return authenticate("/auth/login", values);
  }

  async function register(values) {
    return authenticate("/auth/register", values);
  }

  async function refreshUser() {
    const result = await api("/auth/me", { token });
    setUser(result.user);
    return result.user;
  }

  async function logout() {
    try {
      await api("/auth/logout", {
        method: "POST",
        token
      });
    } catch (error) {
      // An already-expired session can still be cleared locally.
      if (error.status !== 401) {
        throw error;
      }
    }

    clearSession();
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        sessionError,
        connected,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}