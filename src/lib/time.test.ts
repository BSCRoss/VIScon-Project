import { describe, expect, it } from "vitest";
import { addDays, dateOnly, formatSlot, isValidSlot, isoWeekday, mondayOf, slots, zurichNowMinutes, zurichTodayString } from "./time";

describe("time", () => {
  it("computes the Zurich date across the UTC midnight boundary", () => {
    // 2026-10-10T22:30Z is 2026-10-11 00:30 in Zurich (CEST, UTC+2)
    expect(zurichTodayString(new Date("2026-10-10T22:30:00Z"))).toBe("2026-10-11");
    expect(zurichNowMinutes(new Date("2026-10-10T22:30:00Z"))).toBe(30);
  });
  it("finds Monday and weekdays", () => {
    expect(mondayOf("2026-10-10")).toBe("2026-10-05"); // Saturday -> Monday
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-11")).toBe(7);
    expect(addDays("2026-10-05", 4)).toBe("2026-10-09");
    expect(dateOnly("2026-10-05").toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("validates slots", () => {
    expect(slots()[0]).toBe(660);
    expect(slots().at(-1)).toBe(840);
    expect(isValidSlot(735)).toBe(true);
    expect(isValidSlot(740)).toBe(false);
    expect(formatSlot(735)).toBe("12:15");
  });
});
