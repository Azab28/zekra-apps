import { DateTime } from "luxon";
import { deviceZone } from "./prayer";

/** Today's date (YYYY-MM-DD) in the place's timezone, or the device's: the day the site's actions take. */
export const todayIn = (zone: string | null | undefined) => DateTime.now().setZone(zone || deviceZone() || "UTC").toISODate() ?? "";
