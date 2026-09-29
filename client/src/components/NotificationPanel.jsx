import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

export default function NotificationPanel() {
  const { token } = useAuth();

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await api(
        `/notifications?page=${page}&limit=10`,
        { token }
      );

      setItems(data.notifications);
      setUnread(data.unreadCount);
      setTotal(data.total);
      setError("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    load();
    window.addEventListener("foodbridge:refresh", load);

    return () => {
      window.removeEventListener("foodbridge:refresh", load);
    };
  }, [load]);

  async function markRead(id) {
    setBusy(true);

    try {
      await api(
        id ? `/notifications/${id}/read` : "/notifications/read-all",
        {
          method: "PATCH",
          token
        }
      );

      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Bell size={20} />
          Notifications
          <span className="badge bg-orange-100 text-orange-800">
            {unread} unread
          </span>
        </h2>

        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={load}
            disabled={loading || busy}
            aria-label="Refresh notifications"
          >
            <RefreshCw size={16} />
          </button>

          <button
            className="btn-secondary"
            onClick={() => markRead()}
            disabled={busy || unread === 0}
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-stone-500">
        Live in-app alerts. Background browser push is not enabled.
      </p>

      {error && (
        <p className="error-box mt-4" role="alert">{error}</p>
      )}

      {loading && (
        <p className="mt-4 text-sm" role="status">Updating inbox…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="py-8 text-center text-stone-500">
          Your inbox is clear.
        </p>
      )}

      <div className="mt-4 divide-y divide-stone-100">
        {items.map((item) => (
          <article key={item._id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">
                  {!item.readAt && (
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full bg-orange-500"
                      aria-label="Unread"
                    />
                  )}
                  {item.title}
                </h3>

                <p className="mt-1 text-sm text-stone-600">
                  {item.message}
                </p>

                <p className="mt-2 text-xs text-stone-400">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>

              {!item.readAt && (
                <button
                  className="shrink-0 text-sm font-bold text-emerald-700"
                  onClick={() => markRead(item._id)}
                  disabled={busy}
                >
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          className="btn-secondary"
          disabled={page === 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>

        <span className="text-sm">
          Page {page} of {Math.max(1, Math.ceil(total / 10))}
        </span>

        <button
          className="btn-secondary"
          disabled={page * 10 >= total || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}