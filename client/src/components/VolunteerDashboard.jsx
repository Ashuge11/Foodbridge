import { useCallback, useEffect, useRef, useState } from "react";
import {
  Truck,
  MapPin,
  RefreshCw,
  Navigation,
  ClipboardCheck,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

const STEPS = [
  "assigned",
  "dispatched",
  "picked_up",
  "handover_pending",
  "delivered",
];

function label(value) {
  return String(value || "").replaceAll("_", " ");
}

function dateText(value) {
  return value ? new Date(value).toLocaleString("en-IN") : "Not recorded";
}

function directions(location) {
  const coordinates = location?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !coordinates.every(Number.isFinite)
  ) {
    return null;
  }

  const [longitude, latitude] = coordinates;

  if (
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) {
    return null;
  }

  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    `${latitude},${longitude}`
  );
}

function ChecklistForm({ action, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    packaging: "",
    storage: "",
    condition: "acceptable",
    accepted: true,
    reason: "",
    notes: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const dispatch = action.type === "dispatch";

  function change(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "condition" && value === "concern"
        ? { accepted: false }
        : {}),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;

    setError("");

    if (form.accepted && form.condition !== "acceptable") {
      setError("A checklist with an observed concern cannot be accepted.");
      return;
    }

    if (!form.accepted && form.reason.trim().length < 3) {
      setError("Enter a reason for rejecting the food.");
      return;
    }

    lock.current = true;
    setBusy(true);

    try {
      const result = await api(
        `/deliveries/${action.donation._id}/${action.type}`,
        {
          method: "POST",
          token,
          body: {
            ...form,
            packaging: form.packaging.trim(),
            storage: form.storage.trim(),
            reason: form.reason.trim(),
            notes: form.notes.trim(),
          },
        }
      );

      onSaved(
        result.donation.status === "rejected"
          ? "Food rejected. The declaration and reason have been recorded."
          : dispatch
            ? "Dispatch checklist saved. Confirm pickup when you collect the food."
            : "Handover submitted. The receiving NGO must now confirm receipt."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-orange-200 bg-white p-6">
      <h3 className="text-xl font-bold">
        {dispatch ? "Dispatch checklist" : "Handover checklist"}
      </h3>
      <p className="mt-2 font-medium text-emerald-800">
        {action.donation.foodName}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Record what you observe. Your identity and completion time are saved
        by the backend. These declarations are not a food safety guarantee.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-medium">
            Packaging declaration
            <textarea
              className="field mt-2"
              name="packaging"
              value={form.packaging}
              onChange={change}
              required
              minLength={3}
              maxLength={500}
              rows={2}
              placeholder="Describe the packaging you observed."
            />
          </label>

          <label className="block text-sm font-medium">
            Storage declaration
            <textarea
              className="field mt-2"
              name="storage"
              value={form.storage}
              onChange={change}
              required
              minLength={3}
              maxLength={500}
              rows={2}
              placeholder="Describe storage and transport conditions."
            />
          </label>

          <label className="block text-sm font-medium">
            Observed food condition
            <select
              className="field mt-2"
              name="condition"
              value={form.condition}
              onChange={change}
            >
              <option value="acceptable">Acceptable</option>
              <option value="concern">Concern observed</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Decision
            <select
              className="field mt-2"
              value={String(form.accepted)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accepted: event.target.value === "true",
                }))
              }
            >
              <option
                value="true"
                disabled={form.condition === "concern"}
              >
                Accept and continue
              </option>
              <option value="false">Reject food and stop delivery</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Reason {form.accepted ? "(optional)" : "(required for rejection)"}
            <textarea
              className="field mt-2"
              name="reason"
              value={form.reason}
              onChange={change}
              required={!form.accepted}
              minLength={form.accepted ? undefined : 3}
              maxLength={1000}
            />
          </label>

          <label className="block text-sm font-medium">
            Handover / additional notes (optional)
            <textarea
              className="field mt-2"
              name="notes"
              value={form.notes}
              onChange={change}
              maxLength={1000}
              placeholder="For handover, record who received the food and any relevant details."
            />
          </label>
        </fieldset>

        {error && <p role="alert" className="error-box">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving..." : "Submit checklist"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Back
          </button>
        </div>
      </form>
    </section>
  );
}

export default function VolunteerDashboard() {
  const { user, token, refreshUser } = useAuth();

  const [profile, setProfile] = useState(user);
  const [form, setForm] = useState({
    available: Boolean(user.available),
    address: user.address || "",
    latitude: user.location?.coordinates?.[1] ?? "",
    longitude: user.location?.coordinates?.[0] ?? "",
  });

  const [tab, setTab] = useState("requests");
  const [radius, setRadius] = useState("15");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [action, setAction] = useState(null);
  const [now, setNow] = useState(Date.now());

  const requestVersion = useRef(0);
  const mutationLock = useRef(false);
  const actionPanel = useRef(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);

    try {
      const result = await api(
        tab === "requests"
          ? `/deliveries/requests?radiusKm=${radius}`
          : `/donations/mine?page=${page}&limit=9`,
        { token }
      );

      if (version !== requestVersion.current) return;

      setItems(
        tab === "requests"
          ? result.deliveries || []
          : result.donations || []
      );
      setTotal(result.total ?? 0);
    } catch (err) {
      if (version === requestVersion.current) {
        setItems([]);
        setError(err.message);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [token, tab, radius, page]);

  useEffect(() => {
    load();
    window.addEventListener("foodbridge:refresh", load);

    return () => {
      requestVersion.current += 1;
      window.removeEventListener("foodbridge:refresh", load);
    };
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (action) {
      actionPanel.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [action]);

  function change(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function locate() {
    setError("");

    if (!navigator.geolocation) {
      setError("Location is unavailable. Enter coordinates manually.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));
        setLocating(false);
      },
      () => {
        setError("Could not get location. Enter coordinates manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function saveAvailability(event) {
    event.preventDefault();
    if (mutationLock.current) return;

    mutationLock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await api("/deliveries/availability", {
        method: "PATCH",
        token,
        body: {
          available: form.available,
          address: form.address.trim(),
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        },
      });

      setProfile(result.user);
      setSuccess(
        result.user.available
          ? "Availability saved. You can now accept nearby pickup requests."
          : "You are unavailable for new pickups. Existing assignments remain yours."
      );

      window.dispatchEvent(new Event("foodbridge:refresh"));

      // Updating the shared profile is separate from saving availability.
      try {
        await refreshUser();
      } catch {
        setError(
          "Availability was saved, but the shared profile could not refresh. Reload the page."
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  function selectAction(donation, type) {
    setError("");
    setSuccess("");
    setAction({ donation, type });
  }

  async function confirmAction() {
    if (!action || mutationLock.current) return;

    mutationLock.current = true;
    setBusy(true);
    setError("");

    try {
      await api(`/deliveries/${action.donation._id}/${action.type}`, {
        method: "POST",
        token,
      });

      const accepted = action.type === "accept";
      setAction(null);
      setSuccess(
        accepted
          ? "Delivery assigned to you. Complete the dispatch checklist next."
          : "Pickup recorded. Transport the food to the NGO, then submit handover."
      );

      if (accepted) {
        setPage(1);
        setItems([]);
        setTab("mine");
      }

      window.dispatchEvent(new Event("foodbridge:refresh"));
    } catch (err) {
      setError(err.message);

      if (err.status === 409) {
        setAction(null);
        window.dispatchEvent(new Event("foodbridge:refresh"));
      }
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  function switchTab(value) {
    setAction(null);
    setItems([]);
    setLoading(true);
    setTab(value);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-emerald-950 p-6 text-white md:p-8">
        <p className="text-xs font-bold tracking-widest text-orange-300">
          SMALL JOURNEYS. MEANINGFUL IMPACT.
        </p>
        <h2 className="mt-3 text-3xl font-bold">
          Be the bridge between food and people.
        </h2>
        <p className="mt-3 text-sm text-emerald-100">
          Accept nearby pickups and record each step through to handover.
        </p>
        <span className="mt-5 inline-block rounded-full bg-white/10 px-4 py-2 text-sm">
          {profile.available ? "Available for pickups" : "Unavailable for new pickups"}
        </span>
      </section>

      {error && <p role="alert" className="error-box">{error}</p>}
      {success && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
          {success}
        </p>
      )}

      <form
        onSubmit={saveAvailability}
        className="space-y-4 rounded-3xl border border-emerald-100 bg-white p-6"
      >
        <h3 className="text-xl font-bold">Availability and location</h3>

        <fieldset disabled={busy} className="space-y-4">
          <label className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 font-medium">
            <input
              type="checkbox"
              name="available"
              checked={form.available}
              onChange={change}
              className="h-5 w-5 accent-emerald-600"
            />
            I am available to accept food pickups
          </label>

          <label className="block text-sm font-medium">
            Current address
            <input
              className="field mt-2"
              name="address"
              value={form.address}
              onChange={change}
              required
              minLength={5}
              maxLength={500}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Latitude
              <input
                className="field mt-2"
                type="number"
                name="latitude"
                value={form.latitude}
                onChange={change}
                required
                min="-90"
                max="90"
                step="any"
              />
            </label>
            <label className="block text-sm font-medium">
              Longitude
              <input
                className="field mt-2"
                type="number"
                name="longitude"
                value={form.longitude}
                onChange={change}
                required
                min="-180"
                max="180"
                step="any"
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">
            Use your current location or enter coordinates manually.
            Changes take effect after you click Save availability.
          </p>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || locating}
            onClick={locate}
          >
            <MapPin size={17} />
            {locating ? "Finding location..." : "Use my location"}
          </button>
          <button className="btn btn-primary" disabled={busy || locating}>
            {busy ? "Saving..." : "Save availability"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`btn ${tab === "requests" ? "btn-primary" : "btn-secondary"}`}
          disabled={busy || Boolean(action) || tab === "requests"}
          onClick={() => switchTab("requests")}
        >
          <MapPin size={18} /> Nearby pickups
        </button>
        <button
          className={`btn ${tab === "mine" ? "btn-primary" : "btn-secondary"}`}
          disabled={busy || Boolean(action) || tab === "mine"}
          onClick={() => switchTab("mine")}
        >
          <Truck size={18} /> My deliveries
        </button>
        <button
          className="btn btn-secondary"
          disabled={loading || busy}
          onClick={() => {
            setError("");
            load();
          }}
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {tab === "requests" && (
        <div className="rounded-2xl bg-white p-5">
          <label className="block text-sm font-medium">
            Search radius from your saved location
            <select
              className="field mt-2 max-w-xs"
              value={radius}
              disabled={busy}
              onChange={(event) => setRadius(event.target.value)}
            >
              {[5, 10, 15, 25, 50, 100].map((value) => (
                <option key={value} value={value}>Within {value} km</option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-slate-500">
            Only food already claimed by an NGO and awaiting a volunteer
            appears here. Distances are approximate straight-line distances.
          </p>
          {!profile.available && (
            <p className="mt-3 text-sm text-orange-700">
              Enable availability and save it to see nearby pickup requests.
            </p>
          )}
        </div>
      )}

      <div ref={actionPanel} className="scroll-mt-5">
        {action && ["dispatch", "handover"].includes(action.type) ? (
          <ChecklistForm
            key={`${action.donation._id}-${action.type}`}
            action={action}
            token={token}
            onClose={() => setAction(null)}
            onSaved={(message) => {
              setAction(null);
              setSuccess(message);
              window.dispatchEvent(new Event("foodbridge:refresh"));
            }}
          />
        ) : action ? (
          <section className="rounded-3xl border border-orange-200 bg-orange-50 p-6">
            <h3 className="text-xl font-bold">
              {action.type === "accept" ? "Accept this delivery?" : "Confirm food pickup?"}
            </h3>
            <p className="mt-3 font-semibold">{action.donation.foodName}</p>
            <p className="mt-2 text-sm">
              {action.type === "accept"
                ? "You will be assigned to collect this food and deliver it to the claiming NGO."
                : "Confirm only after you have physically collected the food from the donor."}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={confirmAction}
              >
                {busy ? "Saving..." : "Confirm"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Back
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {loading ? (
        <p className="rounded-3xl bg-white p-8 text-center text-slate-500">
          Loading deliveries...
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-10 text-center">
          <Truck size={38} className="mx-auto text-emerald-600" />
          <h3 className="mt-4 text-xl font-bold">
            {tab === "requests" ? "No pickup requests found" : "No deliveries assigned yet"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {tab === "requests"
              ? "Check availability, saved coordinates, search radius, and whether an NGO has claimed unexpired food."
              : "Accept a request from Nearby pickups to begin."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((donation) => {
            const pickupLink = directions(donation.pickupLocation);
            const destinationLink = directions(
              donation.claim?.destinationLocation
            );
            const unexpired = new Date(donation.expiresAt).getTime() > now;
            const step = STEPS.indexOf(donation.status);
            const delivery = donation.delivery || {};

            return (
              <article
                key={donation._id}
                className="flex flex-col rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm"
              >
                <span className="self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-800">
                  {label(donation.status)}
                </span>
                <h3 className="mt-4 text-xl font-bold">{donation.foodName}</h3>
                {donation.isDemo && (
                  <p className="mt-1 text-xs text-orange-700">Demo data</p>
                )}
                <p className="mt-2 text-sm text-slate-500">
                  {donation.description}
                </p>
                <p className="mt-3 font-semibold text-emerald-800">
                  {donation.quantity} {donation.unit} ·{" "}
                  {donation.estimatedServings} estimated servings
                </p>

                <div className="my-4 space-y-4 rounded-2xl bg-slate-50 p-4 text-sm">
                  <div>
                    <p className="font-bold">Pickup address</p>
                    <p className="mt-1 text-slate-600">{donation.pickupAddress}</p>
                  </div>
                  <div>
                    <p className="font-bold">
                      Destination: {donation.claim?.organizationName || "Receiving NGO"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {donation.claim?.destinationAddress}
                    </p>
                  </div>
                  <p><strong>Storage:</strong> {donation.storageConditions}</p>
                  <p>
                    <strong>Allergens:</strong>{" "}
                    {donation.allergens?.join(", ") || "None listed; not certified allergen-free"}
                  </p>
                </div>

                {donation.distanceKm != null && (
                  <p className="mb-3 text-xs text-slate-500">
                    Pickup approximately {Number(donation.distanceKm).toFixed(1)} km
                    away, straight-line distance.
                  </p>
                )}

                <p className="flex items-center gap-2 text-sm text-orange-700">
                  <Clock size={16} /> Deadline: {dateText(donation.expiresAt)}
                </p>

                {tab === "mine" && step >= 0 && (
                  <ol className="my-4 grid grid-cols-2 gap-2">
                    {STEPS.map((status, index) => (
                      <li
                        key={status}
                        className={`flex items-center gap-2 rounded-lg p-2 text-xs capitalize ${
                          index <= step
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        {label(status)}
                      </li>
                    ))}
                  </ol>
                )}

                {tab === "mine" && (
                  <details className="my-4 rounded-xl border p-3 text-sm">
                    <summary className="cursor-pointer font-semibold">
                      Recorded checklists
                    </summary>
                    <p className="mt-2 text-xs text-slate-500">
                      Participant declarations, not a food safety guarantee.
                    </p>
                    {[
                      ["Dispatch", delivery.dispatchChecklist],
                      ["Handover", delivery.handoverChecklist],
                      ["NGO receipt", delivery.receiptChecklist],
                    ].map(([title, checklist]) => (
                      <div key={title} className="mt-3 border-t pt-3">
                        <p className="font-bold">{title}</p>
                        {!checklist?.completedAt ? (
                          <p className="text-slate-500">Not recorded yet.</p>
                        ) : (
                          <div className="mt-1 space-y-1">
                            <p>{checklist.accepted ? "Accepted" : "Rejected"}</p>
                            <p>Packaging: {checklist.packaging}</p>
                            <p>Storage: {checklist.storage}</p>
                            <p>Condition: {checklist.condition}</p>
                            {checklist.reason && <p>Reason: {checklist.reason}</p>}
                            {checklist.notes && <p>Notes: {checklist.notes}</p>}
                            <p className="text-xs text-slate-500">
                              {checklist.completedByName} · {dateText(checklist.completedAt)}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </details>
                )}

                {donation.cancellationReason && (
                  <p className="my-3 text-sm text-red-700">
                    Cancellation: {donation.cancellationReason}
                  </p>
                )}
                {donation.rejectionReason && (
                  <p className="my-3 text-sm text-red-700">
                    Rejection: {donation.rejectionReason}
                  </p>
                )}

                {donation.status === "handover_pending" && (
                  <p className="my-3 rounded-xl bg-orange-50 p-3 text-sm text-orange-800">
                    Handover submitted. Waiting for the NGO to confirm receipt.
                  </p>
                )}
                {donation.status === "delivered" && (
                  <p className="my-3 text-sm font-semibold text-emerald-700">
                    Delivery completed: {dateText(delivery.deliveredAt)}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {tab === "requests" && (
                    <button
                      className="btn btn-primary"
                      disabled={
                        busy || Boolean(action) || !profile.available ||
                        !unexpired || donation.status !== "claimed"
                      }
                      onClick={() => selectAction(donation, "accept")}
                    >
                      <Truck size={17} /> Accept pickup
                    </button>
                  )}

                  {tab === "mine" &&
                    donation.status === "assigned" && unexpired && (
                      <button
                        className="btn btn-primary"
                        disabled={busy || Boolean(action)}
                        onClick={() => selectAction(donation, "dispatch")}
                      >
                        <ClipboardCheck size={17} /> Dispatch checklist
                      </button>
                    )}

                  {tab === "mine" &&
                    donation.status === "dispatched" && unexpired && (
                      <button
                        className="btn btn-primary"
                        disabled={busy || Boolean(action)}
                        onClick={() => selectAction(donation, "pickup")}
                      >
                        Confirm pickup
                      </button>
                    )}

                  {tab === "mine" &&
                    donation.status === "picked_up" && unexpired && (
                      <button
                        className="btn btn-primary"
                        disabled={busy || Boolean(action)}
                        onClick={() => selectAction(donation, "handover")}
                      >
                        Handover checklist
                      </button>
                    )}

                  {pickupLink && (
                    <a
                      className="btn btn-secondary"
                      href={pickupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation size={16} /> To pickup
                    </a>
                  )}

                  {destinationLink && (
                    <a
                      className="btn btn-secondary"
                      href={destinationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation size={16} /> To NGO
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "mine" && (
        <div className="flex items-center justify-center gap-4">
          <button
            className="btn btn-secondary"
            disabled={page === 1 || loading || Boolean(action)}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span className="text-sm">
            Page {page} of {Math.max(1, Math.ceil(total / 9))}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page * 9 >= total || loading || Boolean(action)}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}