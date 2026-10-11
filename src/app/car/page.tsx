import type { Metadata } from "next";
import { CarApp } from "./car-app";

export const metadata: Metadata = {
  title: "Park my car — Plan P",
  description: "Your backup parking chain near your meeting: Plan A, B and C, ready before you leave.",
};

export default function CarPage() {
  return <CarApp />;
}
