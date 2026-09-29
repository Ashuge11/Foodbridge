import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Leaf, LocateFixed } from "lucide-react";

import { useAuth } from "../context/AuthContext";

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "donor",
  phone: "",
  address: "",
  latitude: "",
  longitude: "",
  organizationName: "",
  registrationNumber: "",
  organizationDescription: ""
};

export default function Register() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function locate() {
    setError("");

    if (!navigator.geolocation) {
      setError("Location is unavailable. Enter coordinates manually.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));

        setLocating(false);
      },
      () => {
        setError(
          "Could not access your location. Enter latitude and longitude manually."
        );
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await register({
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude)
      });

      navigate("/dashboard", { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function input(name, label, type = "text", extra = {}) {
    return (
      <div>
        <label className="label" htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          type={type}
          className="field"
          value={form[name]}
          onChange={change}
          required
          {...extra}
        />
      </div>
    );
  }

  return (
    <main className="hero-pattern min-h-screen px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-7 flex items-center gap-2 text-2xl font-black">
          <Leaf className="text-emerald-700" />
          FoodBridge
        </Link>

        <div className="card p-7 md:p-9">
          <h1 className="text-3xl font-black">Be part of the bridge.</h1>
          <p className="mt-2 text-stone-500">
            Join as a donor, NGO, or volunteer.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            {error && (
              <p className="error-box" role="alert">{error}</p>
            )}

            <div>
              <label className="label" htmlFor="role">I want to join as</label>
              <select
                id="role"
                name="role"
                className="field"
                value={form.role}
                onChange={change}
              >
                <option value="donor">Donor — share surplus food</option>
                <option value="ngo">NGO / shelter — receive food</option>
                <option value="volunteer">Volunteer — help deliver food</option>
              </select>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {input("name", "Full name", "text", {
                minLength: 2,
                maxLength: 100,
                autoComplete: "name"
              })}

              {input("phone", "Phone number", "tel", {
                minLength: 7,
                maxLength: 20,
                autoComplete: "tel"
              })}

              {input("email", "Email address", "email", {
                autoComplete: "email"
              })}

              {input("password", "Password", "password", {
                minLength: 8,
                maxLength: 72,
                autoComplete: "new-password"
              })}
            </div>

            {form.role === "ngo" && (
              <div className="space-y-5 rounded-xl bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-800">
                  NGOs need administrator approval before claiming food.
                </p>

                {input("organizationName", "Organization name", "text", {
                  minLength: 2,
                  maxLength: 150
                })}

                {input("registrationNumber", "Registration / identifying reference", "text", {
                  minLength: 2,
                  maxLength: 100
                })}

                <div>
                  <label className="label" htmlFor="organizationDescription">
                    Describe your organization
                  </label>
                  <textarea
                    id="organizationDescription"
                    name="organizationDescription"
                    className="field"
                    rows={3}
                    minLength={10}
                    maxLength={1000}
                    value={form.organizationDescription}
                    onChange={change}
                    required
                  />
                </div>
              </div>
            )}

            {input("address", "Address", "text", {
              minLength: 5,
              maxLength: 500,
              autoComplete: "street-address"
            })}

            <div className="rounded-xl border border-stone-200 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold">Your location</p>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={locate}
                  disabled={locating}
                >
                  <LocateFixed size={16} />
                  {locating ? "Locating…" : "Use my location"}
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {input("latitude", "Latitude", "number", {
                  min: -90,
                  max: 90,
                  step: "any"
                })}

                {input("longitude", "Longitude", "number", {
                  min: -180,
                  max: 180,
                  step: "any"
                })}
              </div>

              <p className="mt-3 text-xs text-stone-500">
                For a Kolhapur demo location, use latitude 16.7050 and longitude 74.2433.
                For an actual account, enter your own location.
              </p>
            </div>

            <button className="btn-primary w-full" disabled={busy || loading}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-600">
            Already registered?{" "}
            <Link to="/login" className="font-bold text-emerald-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}