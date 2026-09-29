import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Heart,
  HeartHandshake,
  Leaf,
  MapPin,
  PackageCheck,
  Salad,
  ShieldCheck,
  Sparkles,
  Truck,
  Utensils,
  Users
} from "lucide-react";

import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

const steps = [
  {
    icon: Utensils,
    title: "List your surplus",
    description:
      "Share food details, quantity, pickup location, and the time available for collection.",
    number: "01"
  },
  {
    icon: HeartHandshake,
    title: "Find a local connection",
    description:
      "Verified NGOs discover nearby donations and claim food for their communities.",
    number: "02"
  },
  {
    icon: Truck,
    title: "Help it reach someone",
    description:
      "Volunteers collect the donation and coordinate handover with the receiving NGO.",
    number: "03"
  }
];

const benefits = [
  {
    icon: MapPin,
    title: "Local by design",
    text: "Discover donations nearby using location and distance filters."
  },
  {
    icon: ShieldCheck,
    title: "Accountable handovers",
    text: "Record packaging, storage, condition, and acceptance declarations."
  },
  {
    icon: Clock3,
    title: "Time-aware coordination",
    text: "Track deadlines and receive alerts as donation windows close."
  },
  {
    icon: Users,
    title: "A connected community",
    text: "Bring donors, NGOs, and volunteers into one shared workflow."
  }
];

export default function Landing() {
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadImpact = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    try {
      const result = await api("/deliveries/impact", { signal });
      setStats(result.stats);
    } catch (failure) {
      if (failure.name !== "AbortError") {
        setError("Impact data is temporarily unavailable.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadImpact(controller.signal);

    return () => controller.abort();
  }, [loadImpact]);

  const startLink = user ? "/dashboard" : "/register";

  function metric(value) {
    return typeof value === "number"
      ? value.toLocaleString()
      : "—";
  }

  return (
    <div className="landing-shell">
      <header className="sticky top-0 z-40 border-b border-emerald-950/5 bg-white/90 backdrop-blur-xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8"
        >
          <Link
            to="/"
            className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            <span className="brand-mark">
              <Leaf size={24} strokeWidth={2.2} />
            </span>

            <span>
              Food<span className="text-emerald-700">Bridge</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-semibold text-stone-600 md:flex">
            <a
              href="#how-it-works"
              className="transition hover:text-emerald-700"
            >
              How it works
            </a>

            <a
              href="#why-foodbridge"
              className="transition hover:text-emerald-700"
            >
              Why FoodBridge
            </a>

            <a
              href="#impact"
              className="transition hover:text-emerald-700"
            >
              Our impact
            </a>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard" className="btn-primary">
                Dashboard
                <ArrowUpRight size={17} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-bold text-emerald-900 hover:text-emerald-600"
                >
                  Sign in
                </Link>

                <Link
                  to="/register"
                  className="btn-primary !px-4 sm:!px-5"
                >
                  Join us
                  <ArrowUpRight size={16} />
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.12fr_1fr] lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <div className="animate-enter inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold text-emerald-800">
                <Sparkles size={15} />
                SMALL ACTS. FULLER PLATES.
              </div>

              <h1 className="hero-title animate-enter delay-1 mt-6">
                Too good
                <br />
                to waste.
                <br />
                <span className="gradient-text">Too important</span>
                <br />
                <span className="gradient-text">not to share.</span>
              </h1>

              <p className="animate-enter delay-2 mt-6 max-w-lg text-base leading-8 text-stone-600 sm:text-lg">
                Your surplus can become someone’s next meal.
                Connect with local NGOs and volunteers to give
                good food a meaningful destination.
              </p>

              <div className="animate-enter delay-3 mt-8 flex flex-wrap gap-3">
                <Link to={startLink} className="btn-primary !px-7 !py-4">
                  {user ? "Open your dashboard" : "Start sharing food"}
                  <ArrowUpRight size={19} />
                </Link>

                <a
                  href="#how-it-works"
                  className="btn-secondary !px-6 !py-4"
                >
                  Explore how it works
                  <ArrowRight size={17} />
                </a>
              </div>

              <div className="animate-enter delay-3 mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-stone-600 sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <Check size={16} className="text-emerald-600" />
                  Verified NGOs
                </span>

                <span className="flex items-center gap-1.5">
                  <Check size={16} className="text-emerald-600" />
                  Nearby connections
                </span>

                <span className="flex items-center gap-1.5">
                  <Check size={16} className="text-emerald-600" />
                  Tracked handovers
                </span>
              </div>
            </div>

            <div className="animate-enter delay-2 relative px-2 pb-5 pt-4 sm:px-8 lg:px-3">
              <div
                aria-hidden="true"
                className="absolute inset-x-4 bottom-0 top-10 rounded-[3rem] bg-emerald-200/40"
              />

              <div className="hero-board">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                      <Leaf size={20} />
                    </span>

                    <div>
                      <p className="text-sm font-extrabold">
                        A little surplus.
                      </p>
                      <p className="text-xs text-stone-500">
                        A whole lot of possibility.
                      </p>
                    </div>
                  </div>

                  <span className="badge bg-orange-50 text-orange-700">
                    Demo preview
                  </span>
                </div>

                <div className="meal-illustration" aria-hidden="true">
                  <div className="meal-plate">
                    <Salad
                      size={105}
                      strokeWidth={1.35}
                      className="text-emerald-700"
                    />
                  </div>

                  <span className="absolute left-6 top-6 rotate-[-18deg] text-orange-400">
                    <Heart size={24} fill="currentColor" />
                  </span>

                  <span className="absolute bottom-6 right-6 rotate-[18deg] text-emerald-500">
                    <Leaf size={29} />
                  </span>
                </div>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold">
                      Fresh vegetable meals
                    </h2>

                    <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
                      <MapPin size={15} />
                      Demo Campus Kitchen · Kolhapur
                    </p>
                  </div>

                  <span className="badge bg-emerald-50 text-emerald-700">
                    Vegetarian
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-stone-50 p-3">
                    <p className="text-xs text-stone-500">
                      Sample quantity
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      35 estimated servings
                    </p>
                  </div>

                  <div className="rounded-xl bg-orange-50 p-3">
                    <p className="text-xs text-orange-700">
                      Every minute matters
                    </p>
                    <p className="mt-1 text-sm font-bold text-orange-800">
                      Coordinate pickup early
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                    <HeartHandshake size={17} />
                    Share locally. Care collectively.
                  </span>

                  <ArrowUpRight size={18} className="text-emerald-600" />
                </div>
              </div>

              <div className="floating-label animate-float -left-1 top-0 sm:left-0">
                <span className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
                  <CheckCircle2 size={17} />
                </span>
                Built around community
              </div>

              <div className="floating-label animate-float-slow -bottom-1 right-0">
                <span className="rounded-full bg-orange-100 p-1.5 text-orange-600">
                  <Heart size={17} />
                </span>
                Good food. Greater purpose.
              </div>
            </div>
          </div>
        </section>

        <section
          id="impact"
          className="border-y border-emerald-900/5 bg-white"
        >
          <div className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
            <div className="grid gap-7 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Our shared progress
                </p>

                <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                  Every completed
                  <br />
                  handover counts.
                </h2>
              </div>

              <div className="sm:border-l sm:border-stone-100 sm:pl-8">
                <div className="flex items-center gap-3">
                  <PackageCheck className="text-emerald-600" size={25} />
                  <p className="text-4xl font-extrabold tracking-tight">
                    {metric(stats?.completedDonations)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-stone-500">
                  Completed donations
                </p>
              </div>

              <div className="sm:border-l sm:border-stone-100 sm:pl-8">
                <div className="flex items-center gap-3">
                  <Utensils className="text-orange-500" size={25} />
                  <p className="text-4xl font-extrabold tracking-tight">
                    {metric(stats?.estimatedServingsDelivered)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-stone-500">
                  Estimated servings delivered
                </p>
              </div>
            </div>

            <div className="mt-5 text-xs text-stone-500">
              {loading ? (
                <span role="status">Loading platform impact…</span>
              ) : error ? (
                <span role="status">
                  {error}{" "}
                  <button
                    onClick={() => loadImpact()}
                    className="font-bold text-emerald-700 underline"
                  >
                    Retry
                  </button>
                </span>
              ) : (
                <span>
                  Hackathon demonstration: totals include demo/test records.
                  Seeded records account for{" "}
                  {metric(stats?.demoEstimatedServings)} estimated servings.
                </span>
              )}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto max-w-7xl px-5 py-20 lg:px-8"
        >
          <div className="mx-auto max-w-2xl text-center">
            <span className="badge bg-orange-50 text-orange-700">
              THE JOURNEY FROM SURPLUS TO SUPPORT
            </span>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Three steps.
              <span className="text-emerald-700"> One meaningful connection.</span>
            </h2>

            <p className="mt-4 leading-7 text-stone-500">
              A straightforward way for kitchens, organizations,
              and volunteers to work together.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, description, number }) => (
              <article className="feature-card" key={number}>
                <div className="flex items-center justify-between">
                  <span className="feature-icon">
                    <Icon size={26} />
                  </span>

                  <span className="text-4xl font-extrabold tracking-tight text-emerald-900/10">
                    {number}
                  </span>
                </div>

                <h3 className="mt-7 text-xl font-extrabold">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-stone-500">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="why-foodbridge" className="bg-emerald-50/60">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                More than a food listing
              </span>

              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Thoughtful coordination.
                <br />
                <span className="text-emerald-700">
                  From kitchen to community.
                </span>
              </h2>

              <p className="mt-5 leading-7 text-stone-600">
                FoodBridge brings the details together so each
                participant knows what happens next—from listing
                and claim to collection and receipt.
              </p>

              <Link
                to={startLink}
                className="mt-7 inline-flex items-center gap-2 font-bold text-emerald-800"
              >
                Become part of the community
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span className="feature-icon !bg-white">
                    <Icon size={24} />
                  </span>

                  <h3 className="mt-4 text-base font-extrabold">
                    {title}
                  </h3>

                  <p className="mt-2 text-sm leading-7 text-stone-600">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="cta-section rounded-[28px] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-white/5 px-4 py-2 text-xs font-semibold text-emerald-100">
              <Leaf size={15} />
              SUPPORTING SDG 2 · ZERO HUNGER
            </span>

            <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
              Make room for
              <br />
              a little more kindness.
            </h2>

            <p className="mx-auto mt-5 max-w-lg leading-7 text-emerald-100">
              Donate food, support your community, or volunteer
              your time. There is a place for you on FoodBridge.
            </p>

            <Link
              to={startLink}
              className="btn mt-8 bg-white !px-8 text-emerald-900 hover:bg-emerald-50"
            >
              {user ? "Go to dashboard" : "Join FoodBridge"}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 py-8 md:flex-row lg:px-8">
          <div>
            <Link to="/" className="flex items-center gap-2 text-xl font-extrabold">
              <Leaf className="text-emerald-700" size={22} />
              FoodBridge
            </Link>

            <p className="mt-2 text-sm text-stone-500">
              Share food. Share hope.
            </p>
          </div>

          <div className="max-w-md text-sm leading-6 text-stone-500 md:text-right">
            <p>Made for local communities · Kolhapur, Maharashtra</p>
            <p className="mt-2 text-xs">
              Safety checklists record participant declarations;
              they do not guarantee food safety.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}