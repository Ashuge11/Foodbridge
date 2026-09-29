import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  X,
  Truck,
  MapPin,
  Clock,
  RefreshCw,
  CheckCircle2,
  Utensils,
  ArrowLeft,
} from "lucide-react";
import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

const DIETARY_LABELS = [
  "vegetarian",
  "vegan",
  "non-vegetarian",
  "halal",
  "jain",
  "gluten-free",
];

const CANCELLABLE = ["available", "claimed", "assigned"];
const TERMINAL = ["delivered", "cancelled", "expired", "rejected"];

const STEPS = [
  "available",
  "claimed",
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

// datetime-local inputs need local time, not a UTC string.
function localInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 16);
}

function timeRemaining(donation) {
  if (TERMINAL.includes(donation.status)) return label(donation.status);
  const minutes = Math.ceil(
    (new Date(donation.expiresAt).getTime() - Date.now()) / 60000
  );
  if (minutes <= 0) return "Deadline passed";
  if (minutes < 60) return `${minutes} minutes remaining`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
}

function initialForm(user, donation) {
  const coordinates =
    donation?.pickupLocation?.coordinates ||
    user?.location?.coordinates ||
    [];

  return {
    foodName: donation?.foodName || "",
    description: donation?.description || "",
    foodType: donation?.foodType || "cooked",
    quantity: donation?.quantity ?? "",
    unit: donation?.unit || "portions",
    estimatedServings: donation?.estimatedServings ?? "",
    preparedAt: localInputDate(donation?.preparedAt),
    expiresAt: localInputDate(donation?.expiresAt),
    dietaryLabels: donation?.dietaryLabels || [],
    allergens: (donation?.allergens || []).join(", "),
    storageConditions: donation?.storageConditions || "",
    pickupAddress: donation?.pickupAddress || user?.address || "",
    latitude: coordinates[1] ?? "",
    longitude: coordinates[0] ?? "",
    safetyConfirmed: false,
  };
}

function DonationForm({ donation, onSaved, onClose }) {
  const { user, token } = useAuth();
  const [form, setForm] = useState(() => initialForm(user, donation));
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function toggleDiet(value) {
    setForm((current) => ({
      ...current,
      dietaryLabels: current.dietaryLabels.includes(value)
        ? current.dietaryLabels.filter((item) => item !== value)
        : [...current.dietaryLabels, value],
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
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    const expiry = new Date(form.expiresAt);
    const prepared =
      form.foodType === "cooked" ? new Date(form.preparedAt) : null;

    if (!Number.isFinite(expiry.getTime()) || expiry <= new Date()) {
      setError("Choose a pickup deadline in the future.");
      return;
    }

    if (
      prepared &&
      (!Number.isFinite(prepared.getTime()) ||
        prepared > new Date() ||
        prepared >= expiry)
    ) {
      setError("Preparation time must be in the past and before the deadline.");
      return;
    }

    setBusy(true);
    try {
      const body = {
        foodName: form.foodName.trim(),
        description: form.description.trim(),
        foodType: form.foodType,
        quantity: Number(form.quantity),
        unit: form.unit,
        estimatedServings: Number(form.estimatedServings),
        preparedAt: prepared ? prepared.toISOString() : null,
        expiresAt: expiry.toISOString(),
        dietaryLabels: form.dietaryLabels,
        allergens: form.allergens
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        storageConditions: form.storageConditions.trim(),
        pickupAddress: form.pickupAddress.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        safetyConfirmed: form.safetyConfirmed,
      };

      if (donation) body.revision = donation.revision;

      await api(
        donation ? `/donations/${donation._id}` : "/donations",
        {
          method: donation ? "PATCH" : "POST",
          token,
          body,
        }
      );
      onSaved(donation ? "Donation updated." : "Donation published.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-600">
            TURN SURPLUS INTO SUPPORT
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            {donation ? "Edit donation" : "Share a meal. Make a difference."}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Nearby verified NGOs receive alerts for eligible donations.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close donation form"
          className="rounded-full bg-slate-100 p-2 disabled:opacity-50"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Food name
              <input
                className="field mt-2"
                name="foodName"
                value={form.foodName}
                onChange={change}
                required
                minLength={2}
                maxLength={150}
                placeholder="Vegetable rice"
              />
            </label>

            <label className="block text-sm font-medium">
              Food type
              <select
                className="field mt-2"
                name="foodType"
                value={form.foodType}
                onChange={change}
              >
                <option value="cooked">Cooked food</option>
                <option value="raw">Raw food</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium">
            Description
            <textarea
              className="field mt-2"
              name="description"
              value={form.description}
              onChange={change}
              required
              minLength={10}
              maxLength={2000}
              rows={3}
              placeholder="Describe the food, ingredients, and pickup instructions."
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Quantity
              <input
                className="field mt-2"
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={change}
                required
                min="0.01"
                max="100000"
                step="0.01"
              />
            </label>

            <label className="block text-sm font-medium">
              Unit
              <select
                className="field mt-2"
                name="unit"
                value={form.unit}
                onChange={change}
              >
                {["kg", "litres", "portions", "packs"].map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Estimated servings
              <input
                className="field mt-2"
                type="number"
                name="estimatedServings"
                value={form.estimatedServings}
                onChange={change}
                required
                min="1"
                max="100000"
                step="1"
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {form.foodType === "cooked" && (
              <label className="block text-sm font-medium">
                Preparation time
                <input
                  className="field mt-2"
                  type="datetime-local"
                  name="preparedAt"
                  value={form.preparedAt}
                  onChange={change}
                  required
                />
              </label>
            )}

            <label className="block text-sm font-medium">
              Expiry / last pickup time
              <input
                className="field mt-2"
                type="datetime-local"
                name="expiresAt"
                value={form.expiresAt}
                onChange={change}
                required
              />
            </label>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-medium">Dietary labels</legend>
            <div className="flex flex-wrap gap-2">
              {DIETARY_LABELS.map((item) => (
                <label
                  key={item}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                    form.dietaryLabels.includes(item)
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.dietaryLabels.includes(item)}
                    onChange={() => toggleDiet(item)}
                    className="accent-emerald-600"
                  />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium">
            Allergens — separate with commas
            <input
              className="field mt-2"
              name="allergens"
              value={form.allergens}
              onChange={change}
              placeholder="Milk, peanuts, wheat"
            />
            <span className="mt-1 block text-xs text-slate-500">
              An empty field does not certify the food as allergen-free.
            </span>
          </label>

          <label className="block text-sm font-medium">
            Storage conditions
            <textarea
              className="field mt-2"
              name="storageConditions"
              value={form.storageConditions}
              onChange={change}
              required
              minLength={3}
              maxLength={1000}
              rows={2}
              placeholder="Describe how the food has been stored."
            />
          </label>

          <label className="block text-sm font-medium">
            Pickup address
            <textarea
              className="field mt-2"
              name="pickupAddress"
              value={form.pickupAddress}
              onChange={change}
              required
              minLength={5}
              maxLength={500}
              rows={2}
            />
          </label>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <button
              type="button"
              className="btn btn-secondary mb-4"
              onClick={locate}
              disabled={locating}
            >
              <MapPin size={16} />
              {locating ? "Finding location..." : "Use my current location"}
            </button>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Pickup latitude
                <input
                  className="field mt-2"
                  type="number"
                  name="latitude"
                  value={form.latitude}
                  onChange={change}
                  min="-90"
                  max="90"
                  step="any"
                  required
                />
              </label>
              <label className="block text-sm font-medium">
                Pickup longitude
                <input
                  className="field mt-2"
                  type="number"
                  name="longitude"
                  value={form.longitude}
                  onChange={change}
                  min="-180"
                  max="180"
                  step="any"
                  required
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-emerald-800">
              Enter coordinates manually if location access is unavailable.
              Confirm that these coordinates identify the pickup address.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm">
            <input
              type="checkbox"
              name="safetyConfirmed"
              checked={form.safetyConfirmed}
              onChange={change}
              required
              className="mt-1 accent-emerald-600"
            />
            <span>
              I declare that the food information, storage details, and
              deadline are accurate to the best of my knowledge and that
              the food is suitable for donation. This declaration is
              recorded; it is not a food safety guarantee.
            </span>
          </label>
        </fieldset>

        {error && <p role="alert" className="error-box">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={busy || locating}>
            <CheckCircle2 size={18} />
            {busy ? "Saving..." : donation ? "Save changes" : "Publish donation"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Back to donations
          </button>
        </div>
      </form>
    </section>
  );
}

function DeliveryDetails({ donationId, onClose }) {
  const { token } = useAuth();
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api(`/deliveries/${donationId}`, { token });
      setDonation(result.donation);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [donationId, token]);

  useEffect(() => {
    load();
    window.addEventListener("foodbridge:refresh", load);
    return () => window.removeEventListener("foodbridge:refresh", load);
  }, [load]);

  const delivery = donation?.delivery || {};
  const currentStep = STEPS.indexOf(donation?.status);

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 md:p-8">
      <button onClick={onClose} className="btn btn-secondary mb-6">
        <ArrowLeft size={17} /> Back to donations
      </button>

      {error && (
        <div role="alert" className="error-box mb-4">
          {error}
          <button onClick={load} className="ml-3 underline">Retry</button>
        </div>
      )}

      {!donation && !error && <p>Loading delivery details...</p>}

      {donation && (
        <>
          <span className="badge capitalize">{label(donation.status)}</span>
          <h2 className="mt-3 text-2xl font-bold">{donation.foodName}</h2>
          <p className="mt-2 text-slate-500">{donation.description}</p>

          <div className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`rounded-2xl border p-3 text-sm capitalize ${
                  currentStep >= index
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {index + 1}. {label(step)}
              </div>
            ))}
          </div>

          {currentStep === -1 && (
            <p className="mb-5 rounded-xl bg-orange-50 p-4 text-orange-900">
              This donation is {label(donation.status)}.
              {" "}
              {donation.cancellationReason || donation.rejectionReason || ""}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5">
              <h3 className="font-bold">Pickup</h3>
              <p className="mt-2 text-sm">{donation.pickupAddress}</p>
              <p className="mt-2 text-sm text-slate-500">
                Deadline: {dateText(donation.expiresAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <h3 className="font-bold">Receiving NGO</h3>
              <p className="mt-2 text-sm">
                {donation.claim?.organizationName || "Awaiting a claim"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {donation.claim?.destinationAddress || "No destination yet"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <h3 className="font-bold">Volunteer</h3>
              <p className="mt-2 text-sm">
                {delivery.volunteer?.name || "Awaiting assignment"}
              </p>
              {delivery.volunteer?.phone && (
                <p className="mt-2 text-sm">{delivery.volunteer.phone}</p>
              )}
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <h3 className="font-bold">Delivery confirmation</h3>
              <p className="mt-2 text-sm">
                Picked up: {dateText(delivery.pickedUpAt)}
              </p>
              <p className="mt-2 text-sm">
                Delivered: {dateText(delivery.deliveredAt)}
              </p>
            </div>
          </div>

          <h3 className="mb-3 mt-7 font-bold">Recorded declarations</h3>
          <p className="mb-4 text-sm text-slate-500">
            These are participant declarations, not a food safety guarantee.
          </p>

          {[
            ["Dispatch", delivery.dispatchChecklist],
            ["Volunteer handover", delivery.handoverChecklist],
            ["NGO receipt", delivery.receiptChecklist],
          ].map(([title, checklist]) => (
            <div key={title} className="mb-3 rounded-2xl border p-4 text-sm">
              <h4 className="font-bold">{title}</h4>
              {!checklist?.completedAt ? (
                <p className="mt-2 text-slate-500">Not recorded yet.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  <p>{checklist.accepted ? "Accepted" : "Rejected"}</p>
                  <p>Packaging: {checklist.packaging}</p>
                  <p>Storage: {checklist.storage}</p>
                  <p>Condition: {checklist.condition}</p>
                  {checklist.reason && <p>Reason: {checklist.reason}</p>}
                  {checklist.notes && <p>Notes: {checklist.notes}</p>}
                  <p className="text-slate-500">
                    {checklist.completedByName} · {dateText(checklist.completedAt)}
                  </p>
                </div>
              )}
            </div>
          ))}

          <h3 className="mb-3 mt-7 font-bold">Activity history</h3>
          <ol className="space-y-3">
            {(donation.history || []).map((event, index) => (
              <li key={event._id || index} className="border-l-2 border-emerald-200 pl-4">
                <p className="text-sm font-semibold capitalize">
                  {label(event.status)}
                </p>
                <p className="text-sm text-slate-500">{event.note}</p>
                <p className="text-xs text-slate-400">{dateText(event.at)}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export default function DonorDashboard() {
  const { token } = useAuth();
  const [donations, setDonations] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [trackingId, setTrackingId] = useState(null);
  const [cancelId, setCancelId] = useState(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(`/donations/mine?page=${page}&limit=9`, {
        token,
      });
      setDonations(result.donations);
      setTotal(result.total);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, token]);

  useEffect(() => {
    load();
    window.addEventListener("foodbridge:refresh", load);
    return () => window.removeEventListener("foodbridge:refresh", load);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  function saved(message) {
    setFormOpen(false);
    setEditing(null);
    setSuccess(message);
    // Refresh other mounted dashboard widgets too.
    window.dispatchEvent(new Event("foodbridge:refresh"));
  }

  async function cancel(event) {
    event.preventDefault();
    setCancelling(true);
    setError("");
    try {
      await api(`/donations/${cancelId}/cancel`, {
        method: "POST",
        token,
        body: { reason: reason.trim() },
      });
      setCancelId(null);
      setReason("");
      setSuccess("Donation cancelled.");
      window.dispatchEvent(new Event("foodbridge:refresh"));
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (formOpen) {
    return (
      <DonationForm
        donation={editing}
        onSaved={saved}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    );
  }

  if (trackingId) {
    return (
      <DeliveryDetails
        donationId={trackingId}
        onClose={() => setTrackingId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-emerald-950 p-6 text-white md:p-9">
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-800 opacity-50"
        />
        <div className="relative">
          <p className="text-sm font-semibold tracking-widest text-emerald-300">
            EVERY MEAL MATTERS
          </p>
          <h2 className="mt-3 text-3xl font-bold md:text-4xl">
            Good food. Greater impact.
          </h2>
          <p className="mt-3 max-w-xl text-emerald-100">
            Share your surplus with nearby communities and follow every
            donation from your kitchen to its destination.
          </p>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
              setSuccess("");
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-400 px-5 py-3 font-bold text-emerald-950 transition hover:-translate-y-1 hover:bg-orange-300 motion-reduce:transform-none"
          >
            <Plus size={20} /> Create donation
          </button>
        </div>
      </section>

      {success && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
          {success}
        </p>
      )}
      {error && <p role="alert" className="error-box">{error}</p>}

      {cancelId && (
        <form onSubmit={cancel} className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <h3 className="font-bold">Cancel this donation?</h3>
          <label className="mt-3 block text-sm">
            Cancellation reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="field mt-2"
              minLength={3}
              maxLength={1000}
              required
              disabled={cancelling}
            />
          </label>
          <div className="mt-3 flex gap-3">
            <button className="btn btn-primary" disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Confirm cancellation"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={cancelling}
              onClick={() => setCancelId(null)}
            >
              Keep donation
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">My donations</h2>
          <p className="text-sm text-slate-500">
            {total} records · active donations and history
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn btn-secondary"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {loading && donations.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500">
          Loading your donations...
        </p>
      ) : donations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-10 text-center">
          <Utensils className="mx-auto mb-4 text-emerald-600" size={36} />
          <h3 className="text-xl font-bold">Your first donation starts here</h3>
          <p className="mt-2 text-slate-500">
            Click Create donation to share available surplus food.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {donations.map((donation) => {
            const unexpired = new Date(donation.expiresAt) > new Date();
            return (
              <article
                key={donation._id}
                className="flex flex-col rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-700">
                    {label(donation.status)}
                  </span>
                  <span className="text-xs capitalize text-slate-500">
                    {donation.foodType}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900">
                  {donation.foodName}
                </h3>
                {donation.isDemo && (
                  <span className="mt-1 text-xs font-semibold text-orange-700">
                    Demo data
                  </span>
                )}

                <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                  {donation.description}
                </p>
                <p className="mt-4 font-semibold text-emerald-800">
                  {donation.quantity} {donation.unit} ·{" "}
                  {donation.estimatedServings} estimated servings
                </p>

                <p className="mt-3 flex items-start gap-2 text-sm text-slate-500">
                  <MapPin size={16} className="mt-0.5 shrink-0" />
                  {donation.pickupAddress}
                </p>
                <p className="mb-5 mt-3 flex items-center gap-2 text-sm font-medium text-orange-700">
                  <Clock size={16} />
                  {timeRemaining(donation)}
                </p>

                <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setTrackingId(donation._id)}
                  >
                    <Truck size={16} /> Track / details
                  </button>

                  {donation.status === "available" && unexpired && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditing(donation);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={16} /> Edit
                    </button>
                  )}

                  {CANCELLABLE.includes(donation.status) && unexpired && (
                    <button
                      className="btn btn-secondary text-red-700"
                      onClick={() => {
                        setCancelId(donation._id);
                        setReason("");
                        setSuccess("");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <X size={16} /> Cancel
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        <button
          className="btn btn-secondary"
          disabled={page === 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>
        <span className="text-sm">
          Page {page} of {Math.max(1, Math.ceil(total / 9))}
        </span>
        <button
          className="btn btn-secondary"
          disabled={page * 9 >= total || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}