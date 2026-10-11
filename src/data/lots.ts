// Fake demo data (PRD §9). Coordinates are approximate; hours, clearance and rules are made up
// so the planner has real trade-offs to make.

export type LatLng = { lat: number; lng: number };

export type Lot = LatLng & {
  id: string;
  name: string;
  pricePerHour: number;
  hours: string;
  clearanceInches: number;
  rule?: string;
  status: "open" | "full";
};

export type Place = LatLng & { id: string; name: string };

const ft = (feet: number, inches: number) => feet * 12 + inches;

export const LOTS: Lot[] = [
  { id: "L1", name: "Union Square Garage", lat: 37.788, lng: -122.4075, pricePerHour: 6, hours: "24h", clearanceInches: ft(6, 8), status: "open" },
  { id: "L2", name: "Sutter-Stockton Garage", lat: 37.7898, lng: -122.4068, pricePerHour: 5, hours: "24h", clearanceInches: ft(6, 2), status: "open" },
  { id: "L3", name: "Ellis-O'Farrell Garage", lat: 37.7856, lng: -122.407, pricePerHour: 5, hours: "5:30am–1am", clearanceInches: ft(6, 6), status: "open" },
  { id: "L4", name: "Fifth & Mission Garage", lat: 37.7835, lng: -122.4055, pricePerHour: 6, hours: "24h", clearanceInches: ft(6, 10), status: "open" },
  { id: "L5", name: "Moscone Center Garage", lat: 37.784, lng: -122.4005, pricePerHour: 5, hours: "6am–midnight", clearanceInches: ft(7, 0), rule: "Event rate $30 flat on event days", status: "open" },
  { id: "L6", name: "Portsmouth Square Garage", lat: 37.7948, lng: -122.4052, pricePerHour: 4, hours: "24h", clearanceInches: ft(6, 6), status: "open" },
  { id: "L7", name: "St. Mary's Square Garage", lat: 37.792, lng: -122.405, pricePerHour: 5, hours: "6am–10pm", clearanceInches: ft(6, 6), status: "full" },
  { id: "L8", name: "Golden Gateway Garage", lat: 37.7955, lng: -122.399, pricePerHour: 7, hours: "6am–7pm", clearanceInches: ft(7, 0), rule: "Monthly permits only 7–10am", status: "open" },
  { id: "L9", name: "Embarcadero Center Garage", lat: 37.795, lng: -122.3975, pricePerHour: 8, hours: "24h", clearanceInches: ft(6, 8), status: "open" },
  { id: "L10", name: "Civic Center Garage", lat: 37.7795, lng: -122.418, pricePerHour: 4, hours: "24h", clearanceInches: ft(7, 0), status: "open" },
  { id: "L11", name: "Performing Arts Garage", lat: 37.777, lng: -122.4225, pricePerHour: 4, hours: "6am–midnight", clearanceInches: ft(6, 8), status: "open" },
  { id: "L12", name: "Mission-Bartlett Garage", lat: 37.756, lng: -122.4195, pricePerHour: 3, hours: "7am–7pm", clearanceInches: ft(6, 6), status: "open" },
];

export const MEETING_PLACES: Place[] = [
  { id: "frontier", name: "Frontier Tower, 995 Market St", lat: 37.7826, lng: -122.4098 },
  { id: "one-market", name: "Investor meeting, 1 Market St", lat: 37.7941, lng: -122.3951 },
  { id: "salesforce", name: "Salesforce Tower", lat: 37.7897, lng: -122.3972 },
  { id: "moscone", name: "Moscone Center", lat: 37.7842, lng: -122.4016 },
];

export const DEMO_START: Place = { id: "start", name: "Fell St & Van Ness Ave", lat: 37.7765, lng: -122.42 };

export const SF_CENTER: LatLng = { lat: 37.787, lng: -122.407 };

export function formatClearance(inches: number) {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}
