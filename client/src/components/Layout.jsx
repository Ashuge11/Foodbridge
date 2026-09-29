import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";


import {
  Leaf,
  LayoutDashboard,
  Bell,
  LogOut,
  RefreshCw,
  Utensils,
  PackageCheck,
  HeartHandshake
} from "lucide-react";

import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";
import NotificationPanel from "./NotificationPanel";
import DonorDashboard from "./DonorDashboard";
import NgoDashboard from "./NgoDashboard";
import NgoVerificationPanel from "./NgoVerificationPanel";
import VolunteerDashboard from "./VolunteerDashboard";
const roleTitles = {
  donor: "Donor dashboard",
  ngo: "NGO dashboard",
  volunteer: "Volunteer dashboard",
  admin: "Administrator dashboard"
};

export default function Layout() {
  const { user, token, connected, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState("overview");
  const [donations, setDonations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [records, impact] = await Promise.all([
        api(`/donations/mine?page=${page}&limit=9`, { token }),
        api("/deliveries/impact")
      ]);

      setDonations(records.donations);
      setTotal(records.total);
      setStats(impact.stats);
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

    const clock = setInterval(() => setNow(Date.now()), 30000);

    return () => {
      window.removeEventListener("foodbridge:refresh", load);
      clearInterval(clock);
    };
  }, [load]);

  async function refresh() {
    try {
      await refreshUser();
      await load();
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function signOut() {
    setLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoggingOut(false);
    }
  }

  function remaining(donation) {
    if (
      ["delivered", "cancelled", "rejected", "expired"]
        .includes(donation.status)
    ) {
      return donation.status.replaceAll("_", " ");
    }

    const minutes = Math.ceil(
      (new Date(donation.expiresAt).getTime() - now) / 60000
    );

    if (minutes <= 0) return "Deadline passed";
    if (minutes < 60) return `${minutes} min remaining`;

    return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
  }

  const statCards = [
    {
      label: "Completed donations",
      value: stats?.completedDonations,
      icon: PackageCheck
    },
    {
      label: "Estimated servings delivered",
      value: stats?.estimatedServingsDelivered,
      icon: Utensils
    },
    {
      label: user.role === "admin" ? "All donation records" : "Your records",
      value: total,
      icon: HeartHandshake
    }
  ];

  return (
    <div className="min-h-screen bg-stone-50 lg:flex">
      <aside className="border-b border-emerald-900 bg-emerald-950 p-5 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
        <Link to="/" className="flex items-center gap-2 text-2xl font-black">
          <Leaf className="text-orange-400" />
          FoodBridge
        </Link>

        <p className="mt-2 text-xs text-emerald-200">
          GOOD FOOD. GREATER PURPOSE.
        </p>

        <nav className="mt-8 flex gap-2 lg:flex-col">
          <button
            onClick={() => setView("overview")}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${
              view === "overview" ? "bg-emerald-800" : "hover:bg-emerald-900"
            }`}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>

          <button
            onClick={() => setView("notifications")}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold ${
              view === "notifications" ? "bg-emerald-800" : "hover:bg-emerald-900"
            }`}
          >
            <Bell size={18} />
            Notifications
          </button>
          {user.role === "admin" && (
        <button
          type="button"
           onClick={() => setView("ngo-verification")}
           className={`mt-2 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
           view === "ngo-verification"
           ? "bg-emerald-700 text-white"
          : "text-emerald-100 hover:bg-white/10"
      }`}
   >
    NGO verification
  </button>
)}
        </nav>

        <div className="mt-6 rounded-xl bg-emerald-900/60 p-4 lg:mt-12">
          <p className="font-bold">{user.name}</p>
          <p className="mt-1 text-sm capitalize text-emerald-200">
            {user.role}
          </p>
          {user.isDemo && (
            <span className="badge mt-3 bg-orange-100 text-orange-800">
              Demo account
            </span>
          )}
        </div>

        <button
          className="mt-5 flex items-center gap-2 text-sm text-emerald-100"
          onClick={signOut}
          disabled={loggingOut}
        >
          <LogOut size={17} />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Welcome back, {user.name.split(" ")[0]}
            </p>
            <h1 className="mt-1 text-3xl font-black">
              {roleTitles[user.role]}
            </h1>
          </div>

          <span className={`badge ${
            connected
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}>
            {connected ? "● Live updates connected" : "○ Live updates reconnecting"}
          </span>
        </header>

        {error && (
          <p className="error-box mb-5" role="alert">{error}</p>
        )}

        {view === "notifications" ? (
         <NotificationPanel />
        ) : view === "ngo-verification" && user.role === "admin" ? (
         <NgoVerificationPanel />
        ) : user.role === "donor" ? (
          <DonorDashboard />
        ) : user.role === "ngo" ? (
         <NgoDashboard />
        ) : user.role === "volunteer" ? (
         <VolunteerDashboard />
       ) : (
        
          <>
            {user.role === "ngo" && (
              <div className="card mb-6">
                <p className="font-bold">
                  Organization verification:{" "}
                  <span className="capitalize">
                    {user.verificationStatus}
                  </span>
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  {user.verificationStatus === "verified"
                    ? "Your organization is eligible to claim food."
                    : user.verificationStatus === "rejected"
                    ? `Application rejected. ${user.verificationReason}`
                    : "An administrator must approve your organization before you can claim food."}
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {statCards.map(({ label, value, icon: Icon }) => (
                <div className="card" key={label}>
                  <Icon className="mb-4 text-emerald-700" size={25} />
                  <p className="text-3xl font-black">
                    {value ?? "—"}
                  </p>
                  <p className="mt-2 text-sm text-stone-500">{label}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-stone-500">
              Platform impact includes demo/test records.
              Seeded demo contribution: {stats?.demoEstimatedServings ?? "—"} estimated servings.
            </p>

            <div className="mb-5 mt-9 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                {user.role === "admin" ? "Donation records" : "Your donation activity"}
              </h2>

              <button
                className="btn-secondary"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {loading && (
              <p role="status" className="mb-4 text-sm text-stone-500">
                Loading activity…
              </p>
            )}

            {!loading && donations.length === 0 && (
              <div className="card py-12 text-center">
                <HeartHandshake className="mx-auto text-emerald-600" size={40} />
                <h3 className="mt-4 text-lg font-bold">No activity yet</h3>
                <p className="mt-2 text-stone-500">
                  Your donation and delivery records will appear here.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {donations.map((donation) => (
                <article className="card" key={donation._id}>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge bg-emerald-50 capitalize text-emerald-800">
                      {donation.status.replaceAll("_", " ")}
                    </span>

                    {donation.isDemo && (
                      <span className="badge bg-orange-50 text-orange-800">
                        Demo
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-lg font-bold">
                    {donation.foodName}
                  </h3>

                  <p className="mt-2 text-sm text-stone-500">
                    {donation.quantity} {donation.unit} ·{" "}
                    {donation.estimatedServings} estimated servings
                  </p>

                  <p className="mt-3 text-sm text-stone-600">
                    {donation.pickupAddress}
                  </p>

                  <p className="mt-4 text-sm font-bold text-orange-700">
                    {remaining(donation)}
                  </p>
                </article>
              ))}
            </div>

            {total > 9 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  className="btn-secondary"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>

                <span>Page {page}</span>

                <button
                  className="btn-secondary"
                  disabled={page * 9 >= total || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}