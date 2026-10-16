import { Carrot, CookingPot, Leaf } from "lucide-react";

// A category illustration, never a photograph of the actual donation.
export default function FoodVisual({ type = "cooked" }) {
  const raw = type === "raw";
  const Icon = raw ? Carrot : CookingPot;
  return <div className={"food-visual " + (raw ? "food-visual-raw" : "")}>
    <div className="food-visual-orbit" aria-hidden="true"/>
    <Icon size={54} strokeWidth={1.3} aria-hidden="true"/>
    <Leaf className="absolute right-6 top-5 opacity-40" size={24} aria-hidden="true"/>
    <span className="absolute bottom-3 left-4 text-[10px] font-bold uppercase tracking-[.18em] opacity-70">
      {raw ? "Fresh ingredients" : "Prepared with care"} · Illustration
    </span>
  </div>;
}
