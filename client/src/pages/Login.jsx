import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Leaf, ArrowRight } from "lucide-react";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="hero-pattern flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-black">
          <Leaf className="text-emerald-700" />
          FoodBridge
        </Link>

        <div className="card p-7 md:p-9">
          <h1 className="text-3xl font-black">Welcome back.</h1>
          <p className="mt-2 text-stone-500">
            Your next act of kindness starts here.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            {error && (
              <p className="error-box" role="alert">{error}</p>
            )}

            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="field"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="field"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button className="btn-primary w-full" disabled={busy || loading}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-600">
            New to FoodBridge?{" "}
            <Link className="font-bold text-emerald-700" to="/register">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}