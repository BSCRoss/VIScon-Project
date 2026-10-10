import type { Area, Campus } from "@prisma/client";
import { isoWeekday } from "./time";

export const AREA_LABEL: Record<Area, string> = { ZENTRUM: "Zentrum (HG)", HOENGGERBERG: "Hönggerberg" };
export const AREA_SHORT: Record<Area, string> = { ZENTRUM: "HG", HOENGGERBERG: "Höngg" };
export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export const WEEKDAY_LABEL: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };

/** Campus → area. ETH Zentrum and UZH Zentrum are both walkable from the HG; other campuses have no area. */
export function areaOfCampus(campus: Campus): Area | null {
  if (campus === "ETH_ZENTRUM" || campus === "UZH_ZENTRUM") return "ZENTRUM";
  if (campus === "ETH_HOENGGERBERG") return "HOENGGERBERG";
  return null;
}

/** The user's area for a given date, or null when they have not set one for that weekday. */
export function areaForDate(weekdays: { weekday: number; area: Area }[], dateIso: string): Area | null {
  const wd = isoWeekday(dateIso);
  return weekdays.find((w) => w.weekday === wd)?.area ?? null;
}

/** Whether a mensa should be proposed for an area. No area = everything. */
export function mensaMatchesArea(campus: Campus, area: Area | null): boolean {
  if (!area) return true;
  return areaOfCampus(campus) === area;
}
