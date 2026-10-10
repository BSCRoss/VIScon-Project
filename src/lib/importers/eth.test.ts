import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapEthFacilities, mapEthRotas, type EthFacility, type EthRota } from "./eth";
import { mondayOf } from "@/lib/time";

const fx = (f: string) => JSON.parse(readFileSync(path.join(__dirname, "__fixtures__", f), "utf8"));
const rotas: EthRota[] = fx("eth-weeklyrotas.json")["weekly-rota-array"];
const facilities: EthFacility[] = fx("eth-facilities.json")["facility-array"];

describe("ETH importer mapping", () => {
  // pick the first Polyterrasse (9) rota that actually has lines, and import "its" week
  const rota9 = rotas.find((r) => r["facility-id"] === 9 && JSON.stringify(r).includes('"line-id"'))!;
  const monday = mondayOf(rota9["valid-from"]);
  const { dishes, errors, mealTimes } = mapEthRotas(rotas, monday);

  it("produces dishes for Polyterrasse in that week", () => {
    const d9 = dishes.filter((d) => d.mensa.sourceId === "9");
    expect(d9.length).toBeGreaterThan(10);
    expect(errors).toEqual([]);
    expect(mealTimes.get(9)).toContain("Lunch");
  });
  it("maps prices, flags and allergens correctly", () => {
    for (const d of dishes) {
      if (d.priceStudent !== undefined) expect(typeof d.priceStudent).toBe("number");
      for (const a of d.allergenIds) { expect(a).toBeGreaterThanOrEqual(1); expect(a).toBeLessThanOrEqual(14); }
      if (d.isVegan) expect(d.isVegetarian).toBe(true);
      expect(d.date >= monday).toBe(true);
      if (d.imageUrl) expect(d.imageUrl).toContain("client-id=ethz-wcms");
    }
  });
  it("has no duplicate sourceKey per mensa", () => {
    const keys = dishes.map((d) => `${d.mensa.sourceId}|${d.sourceKey}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("includes the standing Rice Up! rota (valid for a year)", () => {
    expect(dishes.some((d) => d.mensa.sourceId === "22")).toBe(true);
  });
  it("maps facilities with campus", () => {
    const m = mapEthFacilities(facilities, mealTimes);
    const poly = m.find((x) => x.sourceId === "9")!;
    expect(poly.name).toBe("Mensa Polyterrasse");
    expect(poly.campus).toBe("ETH_ZENTRUM");
    expect(poly.offersDinner).toBe(true);
    expect(m.find((x) => x.sourceId === "22")!.campus).toBe("ETH_HOENGGERBERG");
    expect(m.every((x) => x.source === "ETH_COOKPIT")).toBe(true);
  });
});
