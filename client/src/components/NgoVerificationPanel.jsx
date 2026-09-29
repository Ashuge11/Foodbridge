import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building2,
  MapPin,
} from "lucide-react";

import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

export default function NgoVerificationPanel() {
  const { token, user } = useAuth();

  const [ngos, setNgos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestVersion = useRef(0);
  const actionLock = useRef(false);
  const isAdmin = user?.role === "admin";
  const limit = 6;

  const load = useCallback(
    async (background = false) => {
      if (!isAdmin) return;

      const version = ++requestVersion.current;
      if (!background) setLoading(true);

      try {
        const result = await api(
          `/admin/ngos/pending?page=${page}&limit=${limit}`,
          { token }
        );

        if (version !== requestVersion.current) return;

        const records = result.ngos || [];
        const count = result.total ?? records.length;

        // Move back if the last item on this page was reviewed.
        if (records.length === 0 && page > 1) {
          setPage((current) => current - 1);
          return;
        }

        setNgos(records);
        setTotal(count);
      } catch (err) {
        if (version === requestVersion.current) {
          setError(err.message);
        }
      } finally {
        if (version === requestVersion.current) {
          setLoading(false);
        }
      }
    },
    [isAdmin, page, token]
  );

  useEffect(() => {
    if (!isAdmin) return;

    load();

    const refresh = () => {
      if (!actionLock.current) load(true);
    };

    window.addEventListener("foodbridge:refresh", refresh);

    // Registration may not emit a socket event, so also check periodically.
    const timer = setInterval(refresh, 15000);

    return () => {
      requestVersion.current += 1;
      clearInterval(timer);
      window.removeEventListener("foodbridge:refresh", refresh);
    };
  }, [isAdmin, load]);

  async function reviewNgo(ngo, decision) {
    if (actionLock.current) return;

    const reviewReason = reason.trim();

    if (decision === "rejected" && reviewReason.length < 3) {
      setError("Enter a rejection reason of at least 3 characters.");
      return;
    }

    actionLock.current = true;
    setBusyId(ngo._id);
    setError("");
    setSuccess("");

    try {
      await api(`/admin/ngos/${ngo._id}/verify`, {
        method: "PATCH",
        token,
        body: {
          decision,
          reason:
            decision === "verified"
              ? "Approved by an administrator through the dashboard."
              : reviewReason,
        },
      });

      setSuccess(
        decision === "verified"
          ? `${ngo.organizationName || ngo.name} approved. This NGO can now claim food.`
          : `${ngo.organizationName || ngo.name} rejected. The reason has been saved.`
      );

      setRejectingId(null);
      setReason("");
      await load(true);

      // Refresh other mounted dashboard statistics.
      window.dispatchEvent(new Event("foodbridge:refresh"));
    } catch (err) {
      setError(err.message);

      // Another administrator may already have reviewed this NGO.
      if (err.status === 409) {
        await load(true);
      }
    } finally {
      actionLock.current = false;
      setBusyId(null);
    }
  }

  if (!isAdmin) return null;

  return (
    <section className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-emerald-950 p-6 text-white">
        <div
          aria-hidden="true"
          className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-emerald-800 opacity-50"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-orange-300">
              <ShieldCheck size={22} />
              <span className="text-xs font-bold tracking-widest">
                ADMINISTRATOR REVIEW
              </span>
            </div>

            <h2 className="text-2xl font-bold">NGO verification</h2>
            <p className="mt-2 text-sm text-emerald-100">
              Review organization details and approve eligible NGOs.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 px-6 py-4 text-center">
            <p className="text-3xl font-bold">{total}</p>
            <p className="text-xs text-emerald-100">Awaiting review</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Pending registrations refresh every 15 seconds.
        </p>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={loading || Boolean(busyId)}
          onClick={() => {
            setError("");
            load();
          }}
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {success && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {success}
        </p>
      )}

      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-center text-slate-500">
          Loading pending NGOs...
        </div>
      ) : ngos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-10 text-center">
          <ShieldCheck
            size={40}
            className="mx-auto text-emerald-600"
          />
          <h3 className="mt-4 text-xl font-bold">No pending NGOs</h3>
          <p className="mt-2 text-sm text-slate-500">
            New NGO registrations will appear here for review.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {ngos.map((ngo) => (
            <article
              key={ngo._id}
              className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <Building2 size={24} />
                </div>

                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                  Pending verification
                </span>
              </div>

              <h3 className="mt-4 text-xl font-bold text-slate-900">
                {ngo.organizationName || ngo.name}
              </h3>

              {ngo.isDemo && (
                <p className="mt-1 text-xs font-semibold text-orange-700">
                  Demo organization
                </p>
              )}

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-slate-700">
                    Contact person
                  </dt>
                  <dd className="text-slate-500">{ngo.name}</dd>
                </div>

                <div>
                  <dt className="font-semibold text-slate-700">
                    Email
                  </dt>
                  <dd className="break-all text-slate-500">
                    {ngo.email}
                  </dd>
                </div>

                <div>
                  <dt className="font-semibold text-slate-700">
                    Phone
                  </dt>
                  <dd className="text-slate-500">
                    {ngo.phone || "Not provided"}
                  </dd>
                </div>

                <div>
                  <dt className="font-semibold text-slate-700">
                    Registration number
                  </dt>
                  <dd className="break-words text-slate-500">
                    {ngo.registrationNumber || "Not provided"}
                  </dd>
                </div>

                <div>
                  <dt className="font-semibold text-slate-700">
                    Organization description
                  </dt>
                  <dd className="whitespace-pre-wrap break-words text-slate-500">
                    {ngo.organizationDescription || "Not provided"}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <MapPin size={17} className="mt-0.5 shrink-0" />
                {ngo.address || "Address not provided"}
              </p>

              <p className="mt-3 text-xs text-slate-400">
                Registered:{" "}
                {ngo.createdAt
                  ? new Date(ngo.createdAt).toLocaleString("en-IN")
                  : "Not recorded"}
              </p>

              {rejectingId === ngo._id ? (
                <form
                  className="mt-5 space-y-3 border-t pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    reviewNgo(ngo, "rejected");
                  }}
                >
                  <label className="block text-sm font-medium">
                    Reason for rejection
                    <textarea
                      className="field mt-2"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      required
                      minLength={3}
                      maxLength={1000}
                      disabled={Boolean(busyId)}
                      placeholder="Explain what is missing or needs correction."
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="btn btn-secondary text-red-700"
                      disabled={Boolean(busyId)}
                    >
                      {busyId === ngo._id
                        ? "Saving..."
                        : "Confirm rejection"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={Boolean(busyId)}
                      onClick={() => {
                        setRejectingId(null);
                        setReason("");
                      }}
                    >
                      Back
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={Boolean(busyId)}
                    onClick={() => reviewNgo(ngo, "verified")}
                  >
                    <CheckCircle2 size={18} />
                    {busyId === ngo._id ? "Approving..." : "Approve NGO"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary text-red-700"
                    disabled={Boolean(busyId)}
                    onClick={() => {
                      setRejectingId(ngo._id);
                      setReason("");
                      setError("");
                    }}
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {total > limit && (
        <div className="flex items-center justify-center gap-4">
          <button
            className="btn btn-secondary"
            disabled={page === 1 || loading || Boolean(busyId)}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>

          <span className="text-sm">
            Page {page} of {Math.max(1, Math.ceil(total / limit))}
          </span>

          <button
            className="btn btn-secondary"
            disabled={
              page * limit >= total || loading || Boolean(busyId)
            }
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}