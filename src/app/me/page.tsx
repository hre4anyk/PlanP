import type { Metadata } from "next";
import { MeApp } from "./me-app";

export const metadata: Metadata = {
  title: "Park me — Plan P",
  description: "Point your phone at a room. Plan P finds the free seats and walks you to one, with a backup ready.",
};

export default function MePage() {
  return <MeApp />;
}
