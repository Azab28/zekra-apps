/** City presets: picking one fills timezone, coordinates and the usual calculation method. */
export type CityPreset = {
  name: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
  calcMethod: string;
};

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The preset city closest to a location (for its timezone, method and a name). */
export function nearestCity(lat: number, lng: number) {
  return CITIES.map((c) => ({ c, d: distanceKm(lat, lng, c.latitude, c.longitude) })).sort((a, b) => a.d - b.d)[0];
}

/** Beyond this from every preset city, a location keeps its own coordinates and a generic method. */
export const NEAR_KM = 400;

export const CITIES: CityPreset[] = [
  { name: "القاهرة", country: "مصر", timezone: "Africa/Cairo", latitude: 30.0444, longitude: 31.2357, calcMethod: "Egyptian" },
  { name: "الإسكندرية", country: "مصر", timezone: "Africa/Cairo", latitude: 31.2001, longitude: 29.9187, calcMethod: "Egyptian" },
  { name: "الدقهلية (المنصورة)", country: "مصر", timezone: "Africa/Cairo", latitude: 31.0409, longitude: 31.3785, calcMethod: "Egyptian" },
  { name: "أسيوط", country: "مصر", timezone: "Africa/Cairo", latitude: 27.1783, longitude: 31.1859, calcMethod: "Egyptian" },
  { name: "أسوان", country: "مصر", timezone: "Africa/Cairo", latitude: 24.0889, longitude: 32.8998, calcMethod: "Egyptian" },
  { name: "مكة المكرمة", country: "السعودية", timezone: "Asia/Riyadh", latitude: 21.3891, longitude: 39.8579, calcMethod: "UmmAlQura" },
  { name: "المدينة المنورة", country: "السعودية", timezone: "Asia/Riyadh", latitude: 24.5247, longitude: 39.5692, calcMethod: "UmmAlQura" },
  { name: "الرياض", country: "السعودية", timezone: "Asia/Riyadh", latitude: 24.7136, longitude: 46.6753, calcMethod: "UmmAlQura" },
  { name: "جدة", country: "السعودية", timezone: "Asia/Riyadh", latitude: 21.4858, longitude: 39.1925, calcMethod: "UmmAlQura" },
  { name: "الدمام", country: "السعودية", timezone: "Asia/Riyadh", latitude: 26.4207, longitude: 50.0888, calcMethod: "UmmAlQura" },
  { name: "دبي", country: "الإمارات", timezone: "Asia/Dubai", latitude: 25.2048, longitude: 55.2708, calcMethod: "Dubai" },
  { name: "أبوظبي", country: "الإمارات", timezone: "Asia/Dubai", latitude: 24.4539, longitude: 54.3773, calcMethod: "Dubai" },
  { name: "الكويت", country: "الكويت", timezone: "Asia/Kuwait", latitude: 29.3759, longitude: 47.9774, calcMethod: "Kuwait" },
  { name: "الدوحة", country: "قطر", timezone: "Asia/Qatar", latitude: 25.2854, longitude: 51.531, calcMethod: "Qatar" },
  { name: "المنامة", country: "البحرين", timezone: "Asia/Bahrain", latitude: 26.2285, longitude: 50.586, calcMethod: "UmmAlQura" },
  { name: "مسقط", country: "عُمان", timezone: "Asia/Muscat", latitude: 23.588, longitude: 58.3829, calcMethod: "MuslimWorldLeague" },
  { name: "صنعاء", country: "اليمن", timezone: "Asia/Aden", latitude: 15.3694, longitude: 44.191, calcMethod: "MuslimWorldLeague" },
  { name: "عمّان", country: "الأردن", timezone: "Asia/Amman", latitude: 31.9539, longitude: 35.9106, calcMethod: "MuslimWorldLeague" },
  { name: "القدس", country: "فلسطين", timezone: "Asia/Hebron", latitude: 31.7683, longitude: 35.2137, calcMethod: "MuslimWorldLeague" },
  { name: "غزة", country: "فلسطين", timezone: "Asia/Gaza", latitude: 31.5017, longitude: 34.4668, calcMethod: "MuslimWorldLeague" },
  { name: "بيروت", country: "لبنان", timezone: "Asia/Beirut", latitude: 33.8938, longitude: 35.5018, calcMethod: "MuslimWorldLeague" },
  { name: "دمشق", country: "سوريا", timezone: "Asia/Damascus", latitude: 33.5138, longitude: 36.2765, calcMethod: "MuslimWorldLeague" },
  { name: "بغداد", country: "العراق", timezone: "Asia/Baghdad", latitude: 33.3152, longitude: 44.3661, calcMethod: "MuslimWorldLeague" },
  { name: "الخرطوم", country: "السودان", timezone: "Africa/Khartoum", latitude: 15.5007, longitude: 32.5599, calcMethod: "Egyptian" },
  { name: "طرابلس", country: "ليبيا", timezone: "Africa/Tripoli", latitude: 32.8872, longitude: 13.1913, calcMethod: "MuslimWorldLeague" },
  { name: "تونس", country: "تونس", timezone: "Africa/Tunis", latitude: 36.8065, longitude: 10.1815, calcMethod: "MuslimWorldLeague" },
  { name: "الجزائر", country: "الجزائر", timezone: "Africa/Algiers", latitude: 36.7538, longitude: 3.0588, calcMethod: "MuslimWorldLeague" },
  { name: "الرباط", country: "المغرب", timezone: "Africa/Casablanca", latitude: 34.0209, longitude: -6.8416, calcMethod: "MuslimWorldLeague" },
  { name: "الدار البيضاء", country: "المغرب", timezone: "Africa/Casablanca", latitude: 33.5731, longitude: -7.5898, calcMethod: "MuslimWorldLeague" },
  { name: "نواكشوط", country: "موريتانيا", timezone: "Africa/Nouakchott", latitude: 18.0735, longitude: -15.9582, calcMethod: "MuslimWorldLeague" },
  { name: "مقديشو", country: "الصومال", timezone: "Africa/Mogadishu", latitude: 2.0469, longitude: 45.3182, calcMethod: "MuslimWorldLeague" },
  { name: "إسطنبول", country: "تركيا", timezone: "Europe/Istanbul", latitude: 41.0082, longitude: 28.9784, calcMethod: "Turkey" },
  { name: "لندن", country: "بريطانيا", timezone: "Europe/London", latitude: 51.5074, longitude: -0.1278, calcMethod: "MoonsightingCommittee" },
  { name: "باريس", country: "فرنسا", timezone: "Europe/Paris", latitude: 48.8566, longitude: 2.3522, calcMethod: "MuslimWorldLeague" },
  { name: "برلين", country: "ألمانيا", timezone: "Europe/Berlin", latitude: 52.52, longitude: 13.405, calcMethod: "MuslimWorldLeague" },
  { name: "نيويورك", country: "أمريكا", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006, calcMethod: "NorthAmerica" },
  { name: "كوالالمبور", country: "ماليزيا", timezone: "Asia/Kuala_Lumpur", latitude: 3.139, longitude: 101.6869, calcMethod: "Singapore" },
  { name: "جاكرتا", country: "إندونيسيا", timezone: "Asia/Jakarta", latitude: -6.2088, longitude: 106.8456, calcMethod: "Singapore" },
  { name: "كراتشي", country: "باكستان", timezone: "Asia/Karachi", latitude: 24.8607, longitude: 67.0011, calcMethod: "Karachi" },
  // The rest of Egypt's governorates (at their capitals). Appended: the bot's buttons carry the index (pt:s:<i>).
  { name: "الجيزة", country: "مصر", timezone: "Africa/Cairo", latitude: 30.0131, longitude: 31.2089, calcMethod: "Egyptian" },
  { name: "القليوبية (بنها)", country: "مصر", timezone: "Africa/Cairo", latitude: 30.4659, longitude: 31.1848, calcMethod: "Egyptian" },
  { name: "البحيرة (دمنهور)", country: "مصر", timezone: "Africa/Cairo", latitude: 31.0341, longitude: 30.4682, calcMethod: "Egyptian" },
  { name: "مطروح (مرسى مطروح)", country: "مصر", timezone: "Africa/Cairo", latitude: 31.3543, longitude: 27.2373, calcMethod: "Egyptian" },
  { name: "كفر الشيخ", country: "مصر", timezone: "Africa/Cairo", latitude: 31.1107, longitude: 30.9388, calcMethod: "Egyptian" },
  { name: "الغربية (طنطا)", country: "مصر", timezone: "Africa/Cairo", latitude: 30.7865, longitude: 31.0004, calcMethod: "Egyptian" },
  { name: "المنوفية (شبين الكوم)", country: "مصر", timezone: "Africa/Cairo", latitude: 30.5503, longitude: 31.0106, calcMethod: "Egyptian" },
  { name: "دمياط", country: "مصر", timezone: "Africa/Cairo", latitude: 31.4165, longitude: 31.8133, calcMethod: "Egyptian" },
  { name: "الشرقية (الزقازيق)", country: "مصر", timezone: "Africa/Cairo", latitude: 30.5877, longitude: 31.502, calcMethod: "Egyptian" },
  { name: "بورسعيد", country: "مصر", timezone: "Africa/Cairo", latitude: 31.2653, longitude: 32.3019, calcMethod: "Egyptian" },
  { name: "الإسماعيلية", country: "مصر", timezone: "Africa/Cairo", latitude: 30.5965, longitude: 32.2715, calcMethod: "Egyptian" },
  { name: "السويس", country: "مصر", timezone: "Africa/Cairo", latitude: 29.9668, longitude: 32.5498, calcMethod: "Egyptian" },
  { name: "شمال سيناء (العريش)", country: "مصر", timezone: "Africa/Cairo", latitude: 31.1321, longitude: 33.8033, calcMethod: "Egyptian" },
  { name: "جنوب سيناء (الطور)", country: "مصر", timezone: "Africa/Cairo", latitude: 28.2417, longitude: 33.6222, calcMethod: "Egyptian" },
  { name: "الفيوم", country: "مصر", timezone: "Africa/Cairo", latitude: 29.3084, longitude: 30.8428, calcMethod: "Egyptian" },
  { name: "بني سويف", country: "مصر", timezone: "Africa/Cairo", latitude: 29.0661, longitude: 31.0994, calcMethod: "Egyptian" },
  { name: "المنيا", country: "مصر", timezone: "Africa/Cairo", latitude: 28.1099, longitude: 30.7503, calcMethod: "Egyptian" },
  { name: "سوهاج", country: "مصر", timezone: "Africa/Cairo", latitude: 26.5591, longitude: 31.6957, calcMethod: "Egyptian" },
  { name: "قنا", country: "مصر", timezone: "Africa/Cairo", latitude: 26.1551, longitude: 32.716, calcMethod: "Egyptian" },
  { name: "الأقصر", country: "مصر", timezone: "Africa/Cairo", latitude: 25.6872, longitude: 32.6396, calcMethod: "Egyptian" },
  { name: "البحر الأحمر (الغردقة)", country: "مصر", timezone: "Africa/Cairo", latitude: 27.2579, longitude: 33.8116, calcMethod: "Egyptian" },
  { name: "الوادي الجديد (الخارجة)", country: "مصر", timezone: "Africa/Cairo", latitude: 25.439, longitude: 30.5586, calcMethod: "Egyptian" },
];

/** Earlier names of preset cities (saved places and links keep working). */
const RENAMED: Record<string, string> = { المنصورة: "الدقهلية (المنصورة)" };

/** The preset city with this name (or its earlier name). */
export function cityByName(name: string | null | undefined): CityPreset | undefined {
  if (!name) return undefined;
  const current = Object.hasOwn(RENAMED, name) ? RENAMED[name] : name;
  return CITIES.find((c) => c.name === current);
}

/** A country's cities for pickers: Egypt's capital first, then by name. */
export function citiesOf(country: string): CityPreset[] {
  const list = CITIES.filter((c) => c.country === country);
  return country === "مصر" ? [list[0], ...list.slice(1).sort((a, b) => a.name.localeCompare(b.name, "ar"))] : list;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
