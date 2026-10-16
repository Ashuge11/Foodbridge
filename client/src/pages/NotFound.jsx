import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="text-center">
        <p className="text-6xl font-black text-emerald-700">404</p>
        <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
        <Link to="/" className="btn-primary mt-6">
          Back to FoodBridge
        </Link>
      </div>
    </main>
  );
}