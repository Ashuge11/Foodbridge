import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error("FoodBridge screen failed:", error.name); }
  render() {
    if (this.state.failed) return (
      <main className="mx-auto my-16 max-w-lg rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold">This screen could not load</h1>
        <p role="alert" className="my-4">
          Reload the page to try again. Check your dashboard before repeating an action.
        </p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </main>
    );
    return this.props.children;
  }
}
