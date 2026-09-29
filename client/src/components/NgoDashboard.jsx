import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import {
  Search,
  MapPin,
  RefreshCw,
  Utensils,
  Truck,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";
import "leaflet/dist/leaflet.css";

const DIETS = [
  "vegetarian",
  "vegan",
  "non-vegetarian",
  "halal",
  "jain",
  "gluten-free",
];

const STEPS = [
  "claimed",
  "assigned",
  "dispatched",
  "picked_up",
  "handover_pending",
  "delivered",
];

const formatStatus = (value) =>
  String(value || "").replaceAll("_", " ");

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-IN") : "Not recorded";

function remaining(value, now) {
  const minutes = Math.ceil((new Date(value).getTime() - now) / 60000);
  if (minutes <= 0) return "Deadline passed";
  if (minutes < 60) return `${minutes} min remaining`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`;
}

function validPosition(location) {
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
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  // MongoDB stores longitude first; Leaflet uses latitude first.
  return [latitude, longitude];
}

function directionsUrl(location) {
  const position = validPosition(location);
  if (!position) return null;

  return (
    "https://www.google.com/maps/dir/?api=1&destination=" +
    `${position[0]},${position[1]}`
  );
}

function FitBounds({ points }) {
  const map = useMap();
  const pointsKey = JSON.stringify(points);

  useEffect(() => {
    const positions = JSON.parse(pointsKey);
    map.invalidateSize();

    if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else if (positions.length > 1) {
      map.fitBounds(positions, {
        padding: [35, 35],
        maxZoom: 15,
      });
    }
  }, [map, pointsKey]);

  return null;
}

function FoodMap({ donations, user, browse, onClaim, busy, now }) {
  const ngoPosition = validPosition(user.location);

  const markers = donations
    .map((donation) => ({
      donation,
      pickup: validPosition(donation.pickupLocation),
      destination: validPosition(donation.claim?.destinationLocation),
    }))
    .filter((item) => item.pickup);

  const points = [
    ...(ngoPosition ? [ngoPosition] : []),
    ...markers.flatMap((item) => [
      item.pickup,
      ...(!browse && item.destination ? [item.destination] : []),
    ]),
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white">
      <div className="flex flex-wrap justify-between gap-3 p-5">
        <div>
          <h3 className="font-bold text-emerald-950">Food locations</h3>
          <p className="mt-1 text-sm text-slate-500">
            Select a marker to see details.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-emerald-700">● Pickup</span>
          <span className="text-orange-700">● NGO / destination</span>
        </div>
      </div>

      <MapContainer
        center={ngoPosition || markers[0]?.pickup || [16.705, 74.2433]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: 400, width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={points} />

        {ngoPosition && (
          <CircleMarker
            center={ngoPosition}
            radius={11}
            pathOptions={{
              color: "#c2410c",
              fillColor: "#f97316",
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <strong>Your NGO</strong>
              <p>{user.address}</p>
            </Popup>
          </CircleMarker>
        )}

        {markers.map(({ donation, pickup, destination }) => (
          <div key={donation._id}>
            <CircleMarker
              center={pickup}
              radius={8}
              pathOptions={{
                color: "#065f46",
                fillColor: "#10b981",
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="min-w-[190px]">
                  <strong>{donation.foodName}</strong>
                  <p>
                    {donation.quantity} {donation.unit}
                    <br />
                    {donation.estimatedServings} estimated servings
                  </p>
                  <p>{donation.pickupAddress}</p>
                  <p>Deadline: {formatDate(donation.expiresAt)}</p>

                  {browse && (
                    <button
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
                      disabled={
                        busy ||
                        user.verificationStatus !== "verified" ||
                        donation.status !== "available" ||
                        new Date(donation.expiresAt).getTime() <= now
                      }
                      onClick={() => onClaim(donation)}
                    >
                      Claim food
                    </button>
                  )}
                </div>
              </Popup>
            </CircleMarker>

            {!browse && destination && (
              <CircleMarker
                center={destination}
                radius={9}
                pathOptions={{
                  color: "#c2410c",
                  fillColor: "#fb923c",
                  fillOpacity: 0.8,
                }}
              >
                <Popup>
                  <strong>Destination: {donation.foodName}</strong>
                  <p>{donation.claim.destinationAddress}</p>
                </Popup>
              </CircleMarker>
            )}
          </div>
        ))}
      </MapContainer>

      <p className="p-4 text-xs text-slate-500">
        Distances are approximate straight-line distances. Use the directions
        links on food cards for road navigation. Map tiles require internet;
        the list below remains usable if tiles do not load.
      </p>
    </section>
  );
}

function ReceiptForm({ donation, token, onClose, onSaved }) {
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
    setError("");

    if (form.accepted && form.condition !== "acceptable") {
      setError("Food with an observed concern cannot be accepted.");
      return;
    }

    if (!form.accepted && form.reason.trim().length < 3) {
      setError("Explain why you are rejecting the food.");
      return;
    }

    setBusy(true);

    try {
      await api(`/deliveries/${donation._id}/receive`, {
        method: "POST",
        token,
        body: {
          ...form,
          packaging: form.packaging.trim(),
          storage: form.storage.trim(),
          reason: form.reason.trim(),
          notes: form.notes.trim(),
        },
      });

      onSaved(
        form.accepted
          ? "Receipt confirmed. Donation delivered; impact totals will update."
          : "Rejection recorded and participants will be notified."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-orange-200 bg-white p-6">
      <h3 className="text-xl font-bold">
        Confirm receipt: {donation.foodName}
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        Complete this after the food reaches your NGO. The backend records
        your identity and timestamp. These declarations do not guarantee food
        safety.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          {[
            ["packaging", "Observed packaging"],
            ["storage", "Observed storage conditions"],
          ].map(([name, title]) => (
            <label key={name} className="block text-sm font-medium">
              {title}
              <textarea
                className="field mt-2"
                name={name}
                value={form[name]}
                onChange={change}
                required
                minLength={3}
                maxLength={500}
                rows={2}
              />
            </label>
          ))}

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
                Accept food and confirm delivery
              </option>
              <option value="false">Reject food</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Reason {form.accepted ? "(optional)" : "(required)"}
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
            Notes (optional)
            <textarea
              className="field mt-2"
              name="notes"
              value={form.notes}
              onChange={change}
              maxLength={1000}
            />
          </label>
        </fieldset>

        {error && <p className="error-box" role="alert">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving..." : "Submit receipt"}
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

export default function NgoDashboard() {
  const { user, token } = useAuth();

  const [tab, setTab] = useState("browse");
  const [showMap, setShowMap] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Ignore an older response if the user changes tabs or filters.
  const requestVersion = useRef(0);
  const actionPanel = useRef(null);

  const [filters, setFilters] = useState({
    search: "",
    radiusKm: "15",
    foodType: "",
    dietaryLabel: "",
    minMinutes: "0",
  });

  const [query, setQuery] = useState("radiusKm=15");
  const verified = user.verificationStatus === "verified";

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);

    try {
      const path =
        tab === "browse"
          ? `/donations?${query}`
          : `/donations/mine?page=${page}&limit=9`;

      const result = await api(path, { token });

      if (version !== requestVersion.current) return;

      setItems(result.donations || []);
      setTotal(result.total ?? 0);
      setError("");
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [token, tab, query, page]);

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
    if (selected || receipt) {
      actionPanel.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [selected, receipt]);

  function switchTab(value) {
    setSelected(null);
    setReceipt(null);
    setItems([]);
    setLoading(true);
    setTab(value);
  }

  function changeFilter(event) {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function applyFilters(event) {
    event.preventDefault();
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== "") params.set(key, value);
    }

    const nextQuery = params.toString();
    setSelected(null);

    if (nextQuery === query) {
      load();
    } else {
      setQuery(nextQuery);
    }
  }

  function selectClaim(donation) {
    setSelected(donation);
    setError("");
    setSuccess("");
  }

  async function claimFood() {
    if (!selected) return;

    setBusy(true);
    setError("");

    try {
      await api(`/donations/${selected._id}/claim`, {
        method: "POST",
        token,
      });

      setSelected(null);
      setSuccess(
        "Food reserved for your NGO. Waiting for a volunteer to accept delivery."
      );
      setPage(1);
      setItems([]);
      setTab("mine");
      window.dispatchEvent(new Event("foodbridge:refresh"));
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        setSelected(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-emerald-950 p-6 text-white md:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-emerald-800 opacity-40"
        />
        <div className="relative">
          <p className="text-xs font-bold tracking-widest text-orange-300">
            GOOD FOOD. GREATER PURPOSE.
          </p>
          <h2 className="mt-3 text-3xl font-bold">
            Bring more meals to your community.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-emerald-100">
            Find nearby surplus, reserve food for your organization,
            and follow its journey to your doorstep.
          </p>
          <span className="mt-5 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm capitalize">
            Organization: {user.verificationStatus}
          </span>
        </div>
      </section>

      {!verified && (
        <p className="rounded-xl bg-orange-50 p-4 text-sm text-orange-900">
          Your organization must be verified by an administrator before it can
          claim food.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`btn ${tab === "browse" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => switchTab("browse")}
          disabled={busy || tab === "browse"}
        >
          <Utensils size={18} /> Browse food
        </button>
        <button
          className={`btn ${tab === "mine" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => switchTab("mine")}
          disabled={busy || tab === "mine"}
        >
          <Truck size={18} /> My claims
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setShowMap((value) => !value)}
          aria-expanded={showMap}
        >
          <MapPin size={18} /> {showMap ? "Hide map" : "Show map"}
        </button>
        <button
          className="btn btn-secondary"
          onClick={load}
          disabled={loading || busy}
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {success && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
          {success}
        </p>
      )}
      {error && <p role="alert" className="error-box">{error}</p>}

      {tab === "browse" && (
        <form
          onSubmit={applyFilters}
          className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-sm font-medium">
            Search food
            <input
              className="field mt-2"
              name="search"
              value={filters.search}
              onChange={changeFilter}
              maxLength={100}
              placeholder="Rice, chapati, vegetables..."
            />
          </label>

          <label className="text-sm font-medium">
            Distance from registered NGO location
            <select
              className="field mt-2"
              name="radiusKm"
              value={filters.radiusKm}
              onChange={changeFilter}
            >
              {[5, 10, 15, 25, 50, 100].map((value) => (
                <option key={value} value={value}>Within {value} km</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Food type
            <select
              className="field mt-2"
              name="foodType"
              value={filters.foodType}
              onChange={changeFilter}
            >
              <option value="">All types</option>
              <option value="raw">Raw</option>
              <option value="cooked">Cooked</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Dietary preference
            <select
              className="field mt-2"
              name="dietaryLabel"
              value={filters.dietaryLabel}
              onChange={changeFilter}
            >
              <option value="">All dietary labels</option>
              {DIETS.map((diet) => (
                <option key={diet} value={diet}>{diet}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Minimum time remaining
            <select
              className="field mt-2"
              name="minMinutes"
              value={filters.minMinutes}
              onChange={changeFilter}
            >
              <option value="0">Any remaining time</option>
              <option value="30">At least 30 minutes</option>
              <option value="60">At least 1 hour</option>
              <option value="120">At least 2 hours</option>
              <option value="240">At least 4 hours</option>
            </select>
          </label>

          <button className="btn btn-primary self-end" disabled={loading}>
            <Search size={18} /> Apply filters
          </button>

          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">
            Shows up to 100 matches. Earlier deadlines come first, followed
            by distance. Only available, unexpired food can be claimed.
          </p>
        </form>
      )}

      <div ref={actionPanel} className="scroll-mt-5">
        {selected && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
            <h3 className="text-xl font-bold">Reserve this food?</h3>
            <p className="mt-3">
              <strong>{selected.foodName}</strong> — all{" "}
              {selected.quantity} {selected.unit},{" "}
              approximately {selected.estimatedServings} servings.
            </p>
            <p className="mt-2 text-sm">
              Delivery destination: {user.address}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Claiming reserves the whole listing for your NGO.
              Delivery begins after a volunteer accepts the pickup request.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="btn btn-primary"
                onClick={claimFood}
                disabled={busy || !verified}
              >
                {busy ? "Reserving..." : "Confirm claim"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelected(null)}
                disabled={busy}
              >
                Back
              </button>
            </div>
          </section>
        )}

        {receipt && (
          <ReceiptForm
            key={receipt._id}
            donation={receipt}
            token={token}
            onClose={() => setReceipt(null)}
            onSaved={(message) => {
              setReceipt(null);
              setSuccess(message);
              window.dispatchEvent(new Event("foodbridge:refresh"));
            }}
          />
        )}
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-10 text-center text-slate-500">
          Loading food listings...
        </div>
      ) : (
        <>
          {showMap && (
            <FoodMap
              donations={items}
              user={user}
              browse={tab === "browse"}
              onClaim={selectClaim}
              busy={busy}
              now={now}
            />
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">
              {tab === "browse" ? "Available food" : "Your claimed donations"}
            </h3>
            <span className="text-sm text-slate-500">
              {tab === "browse" ? items.length : total} records
            </span>
          </div>

          {items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-10 text-center">
              <Utensils size={36} className="mx-auto text-emerald-600" />
              <h4 className="mt-4 text-lg font-bold">
                {tab === "browse" ? "No matching food right now" : "No claims yet"}
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                {tab === "browse"
                  ? "Try a larger distance or fewer filters. Cancelled, expired, or already claimed listings are excluded."
                  : "Open Browse food and reserve a donation for your NGO."}
              </p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((donation) => {
              const unexpired = new Date(donation.expiresAt).getTime() > now;
              const pickupUrl = directionsUrl(donation.pickupLocation);
              const destinationUrl = directionsUrl(
                donation.claim?.destinationLocation
              );
              const step = STEPS.indexOf(donation.status);
              const terminal = ["delivered", "cancelled", "expired", "rejected"]
                .includes(donation.status);

              return (
                <article
                  key={donation._id}
                  className="flex flex-col rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-800">
                      {formatStatus(donation.status)}
                    </span>
                    <span className="text-xs capitalize text-slate-500">
                      {donation.foodType}
                    </span>
                  </div>

                  <h4 className="mt-4 text-xl font-bold">
                    {donation.foodName}
                  </h4>
                  {donation.isDemo && (
                    <p className="mt-1 text-xs font-semibold text-orange-700">
                      Demo data
                    </p>
                  )}
                  <p className="mt-2 text-sm text-slate-500">
                    {donation.description}
                  </p>

                  <p className="mt-4 font-semibold text-emerald-800">
                    {donation.quantity} {donation.unit} ·{" "}
                    {donation.estimatedServings} estimated servings
                  </p>

                  <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                    <MapPin size={17} className="mt-0.5 shrink-0" />
                    {donation.pickupAddress}
                  </p>

                  {donation.distanceKm != null && (
                    <p className="mt-2 text-xs text-slate-500">
                      Approximately {Number(donation.distanceKm).toFixed(1)} km
                      straight-line distance
                    </p>
                  )}

                  <p className="mt-3 flex items-center gap-2 text-sm text-orange-700">
                    <Clock size={16} />
                    {terminal
                      ? formatStatus(donation.status)
                      : remaining(donation.expiresAt, now)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Deadline: {formatDate(donation.expiresAt)}
                  </p>

                  <div className="my-4 space-y-2 border-t pt-4 text-sm">
                    <p>
                      <strong>Diet:</strong>{" "}
                      {donation.dietaryLabels?.join(", ") || "Not specified"}
                    </p>
                    <p>
                      <strong>Allergens:</strong>{" "}
                      {donation.allergens?.join(", ") ||
                        "None listed; not certified allergen-free"}
                    </p>
                    <p>
                      <strong>Storage:</strong> {donation.storageConditions}
                    </p>
                    {donation.preparedAt && (
                      <p>
                        <strong>Prepared:</strong>{" "}
                        {formatDate(donation.preparedAt)}
                      </p>
                    )}
                  </div>

                  {tab === "mine" && (
                    <div className="mb-4 rounded-2xl bg-slate-50 p-4">
                      <h5 className="text-sm font-bold">Delivery progress</h5>

                      {step >= 0 && (
                        <ol className="mt-3 space-y-2">
                          {STEPS.map((status, index) => (
                            <li
                              key={status}
                              className={`flex items-center gap-2 text-xs capitalize ${
                                index <= step
                                  ? "text-emerald-700"
                                  : "text-slate-400"
                              }`}
                            >
                              <CheckCircle2 size={14} />
                              {formatStatus(status)}
                            </li>
                          ))}
                        </ol>
                      )}

                      <p className="mt-3 text-xs">
                        Volunteer:{" "}
                        {donation.delivery?.volunteer
                          ? "Assigned"
                          : "Awaiting assignment"}
                      </p>
                      <p className="mt-2 text-xs">
                        Destination: {donation.claim?.destinationAddress}
                      </p>

                      {donation.cancellationReason && (
                        <p className="mt-2 text-xs text-red-700">
                          Cancelled: {donation.cancellationReason}
                        </p>
                      )}
                      {donation.rejectionReason && (
                        <p className="mt-2 text-xs text-red-700">
                          Rejected: {donation.rejectionReason}
                        </p>
                      )}
                      {donation.delivery?.deliveredAt && (
                        <p className="mt-2 text-xs">
                          Delivered: {formatDate(donation.delivery.deliveredAt)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    {tab === "browse" && (
                      <button
                        className="btn btn-primary"
                        onClick={() => selectClaim(donation)}
                        disabled={
                          busy ||
                          !verified ||
                          !unexpired ||
                          donation.status !== "available"
                        }
                      >
                        {!verified ? "Verification required" : "Claim food"}
                      </button>
                    )}

                    {tab === "mine" &&
                      donation.status === "handover_pending" &&
                      unexpired && (
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setReceipt(donation);
                            setSuccess("");
                            setError("");
                          }}
                        >
                          Confirm / reject receipt
                        </button>
                      )}

                    {pickupUrl && (
                      <a
                        className="btn btn-secondary"
                        href={pickupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Pickup directions
                      </a>
                    )}

                    {tab === "mine" && destinationUrl && (
                      <a
                        className="btn btn-secondary"
                        href={destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Destination directions
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {tab === "mine" && (
        <div className="flex items-center justify-center gap-4">
          <button
            className="btn btn-secondary"
            disabled={loading || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span className="text-sm">
            Page {page} of {Math.max(1, Math.ceil(total / 9))}
          </span>
          <button
            className="btn btn-secondary"
            disabled={loading || page * 9 >= total}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}