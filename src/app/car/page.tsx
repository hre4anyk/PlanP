import type { Metadata } from "next";
import { CarModes } from "./car-modes";

export const metadata: Metadata = {
  title: "Park my car — Plan P",
  description: "Find an open street spot with your phone camera, with garage Plan A, B and C as the backup.",
};

export default function CarPage() {
  return <CarModes />;
}
