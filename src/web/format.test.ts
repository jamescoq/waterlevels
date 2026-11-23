import { describe, expect, it } from "vitest";
import { waterTop } from "./components/CutThrough.tsx";
import {
  NBSP,
  changeText,
  czNumber,
  flowText,
  formatDate,
  formatDateTime,
  formatPct,
  levelSentence,
  levelText,
  volumeText,
} from "./format.ts";

const s = (text: string) => text.replaceAll(NBSP, " ");

describe("Czech formatting", () => {
  it("uses a decimal comma", () => {
    expect(czNumber(491.2, 2)).toBe("491,20");
    expect(s(levelText(491.13))).toBe("491,13 m n. m.");
    expect(levelText(null)).toBe("–");
  });

  it("rounds percentages and shows a dash for none", () => {
    expect(s(formatPct(82.4))).toBe("82 %");
    expect(s(formatPct(104.2))).toBe("104 %");
    expect(formatPct(null)).toBe("–");
  });

  it("formats Prague dates and times", () => {
    expect(formatDateTime("2026-11-22T06:00:00Z")).toBe("22. 11. 2026, 7:00");
    expect(formatDateTime("2027-07-01T05:30:00Z")).toBe("1. 7. 2027, 7:30");
    expect(formatDate("2026-11-19T07:00:00+01:00")).toBe("19. 11. 2026");
  });

  it("writes volumes and flows with the design's decimals", () => {
    expect(s(volumeText(147.92, 186.23))).toBe("148 z 186 mil. m³");
    expect(s(volumeText(1.16, 1.46))).toBe("1,2 z 1,5 mil. m³");
    expect(volumeText(null, 10)).toBe("–");
    expect(s(flowText(4.54))).toBe("4,5 m³/s");
    expect(s(flowText(0.16))).toBe("0,16 m³/s");
  });
});

describe("card sentences (station-detail spec)", () => {
  it("states the distance to full storage (spec: Below / Above full storage)", () => {
    expect(s(levelSentence(491.2, 496)!)).toBe("Hladina je 4,8 m pod plnou hladinou");
    expect(s(levelSentence(496.3, 496)!)).toBe("Hladina je 0,3 m nad plnou hladinou");
  });

  it("has no sentence without a storage-zone level (spec: No storage-zone level)", () => {
    expect(levelSentence(463.42, null)).toBeNull();
    expect(levelSentence(null, 496)).toBeNull();
  });

  it("words the change since yesterday", () => {
    expect(s(changeText(12).text)).toBe("Od včerejška stoupla o 12 cm");
    expect(s(changeText(-3).text)).toBe("Od včerejška klesla o 3 cm");
    expect(changeText(0)).toEqual({ trend: "flat", text: "Od včerejška beze změny" });
    expect(changeText(null)).toEqual({ trend: "unknown", text: "Změnu od včerejška neznáme" });
  });
});

describe("waterTop (cut-through)", () => {
  const levels = { maxRetention: 498.8, storage: 496, permanent: 452 };

  it("puts full storage on its line and higher levels into the retention band", () => {
    expect(waterTop(496, levels)).toBe(66);
    expect(waterTop(498.8, levels)).toBe(38);
    expect(waterTop(497.4, levels)).toBe(52);
  });

  it("places lower levels between full storage and the permanent pool", () => {
    expect(waterTop(452, levels)).toBe(168);
    expect(waterTop(474, levels)).toBe(117);
  });

  it("keeps the water line inside the box", () => {
    expect(waterTop(400, levels)).toBeLessThanOrEqual(204);
    expect(waterTop(520, levels)).toBeGreaterThanOrEqual(20);
  });

  it("draws nothing without the permanent pool", () => {
    expect(waterTop(463, { maxRetention: null, storage: 464, permanent: null })).toBeNull();
  });
});
