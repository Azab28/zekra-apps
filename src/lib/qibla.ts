/** The qibla direction and distance from a place (great circle to the Kaaba). Client-safe. */

export const KAABA = { latitude: 21.422487, longitude: 39.826206 };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Degrees clockwise from true north, 0–360. */
export function qiblaBearing(latitude: number, longitude: number): number {
  const φ1 = rad(latitude);
  const φ2 = rad(KAABA.latitude);
  const Δλ = rad(KAABA.longitude - longitude);
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Kilometres to the Kaaba. */
export function kaabaDistanceKm(latitude: number, longitude: number): number {
  const φ1 = rad(latitude);
  const φ2 = rad(KAABA.latitude);
  const a = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(rad(KAABA.longitude - longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const POINTS = ["الشمال", "الشمال الشرقي", "الشرق", "الجنوب الشرقي", "الجنوب", "الجنوب الغربي", "الغرب", "الشمال الغربي"];

/** «الجنوب الشرقي» for a bearing. */
export const compassPoint = (bearing: number) => POINTS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
