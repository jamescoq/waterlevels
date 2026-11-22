import { describe, expect, it } from "vitest";
import { NOT_DEFINED, parseCzechNumber, parsePragueDateTime, parseZoneCell } from "./czech.ts";

describe("parseCzechNumber", () => {
  it("reads a decimal comma and a thousands separator (spec: 1 234,56)", () => {
    expect(parseCzechNumber("1 234,56")).toBe(1234.56);
    expect(parseCzechNumber("1 234,56")).toBe(1234.56);
    expect(parseCzechNumber("1 234,56")).toBe(1234.56);
  });

  it("reads plain, negative and integer values", () => {
    expect(parseCzechNumber("427,71")).toBe(427.71);
    expect(parseCzechNumber("-1,17")).toBe(-1.17);
    expect(parseCzechNumber("0,000")).toBe(0);
    expect(parseCzechNumber("258")).toBe(258);
  });

  it("treats a blank cell as not measured", () => {
    expect(parseCzechNumber("")).toBeNull();
    expect(parseCzechNumber("  \n ")).toBeNull();
  });

  it("rejects anything else instead of guessing", () => {
    for (const bad of ["427.71", "1,2,3", "abc", "12 34", "-", "n/a"]) {
      expect(() => parseCzechNumber(bad)).toThrow();
    }
  });
});

describe("parseZoneCell", () => {
  it("keeps a dash (not defined) apart from a blank (not measured)", () => {
    expect(parseZoneCell("-")).toBe(NOT_DEFINED);
    expect(parseZoneCell(" – ")).toBe(NOT_DEFINED);
    expect(parseZoneCell("")).toBeNull();
    expect(parseZoneCell("92,06")).toBe(92.06);
  });
});

describe("parsePragueDateTime", () => {
  it("uses +01:00 in winter", () => {
    expect(parsePragueDateTime("22.11.2026 10:10")).toBe("2026-11-22T10:10:00+01:00");
  });

  it("uses +02:00 in summer (spec: 1 July 2027 07:00)", () => {
    expect(parsePragueDateTime("1.7.2027 07:00")).toBe("2027-07-01T07:00:00+02:00");
  });

  it("handles the days the clocks change", () => {
    // Summer time starts 28 March 2027 at 02:00 → 03:00.
    expect(parsePragueDateTime("28.3.2027 01:30")).toBe("2027-03-28T01:30:00+01:00");
    expect(parsePragueDateTime("28.3.2027 03:30")).toBe("2027-03-28T03:30:00+02:00");
    expect(() => parsePragueDateTime("28.3.2027 02:30")).toThrow(/does not exist/);
    // Summer time ends 31 October 2027 at 03:00 → 02:00; 02:30 happens twice.
    expect(parsePragueDateTime("31.10.2027 02:30")).toBe("2027-10-31T02:30:00+02:00");
    expect(parsePragueDateTime("31.10.2027 03:30")).toBe("2027-10-31T03:30:00+01:00");
  });

  it("tolerates extra spaces and treats a blank cell as missing", () => {
    expect(parsePragueDateTime(" 22. 11. 2026  9:05 ")).toBe("2026-11-22T09:05:00+01:00");
    expect(parsePragueDateTime("")).toBeNull();
  });

  it("rejects malformed or impossible values", () => {
    for (const bad of ["2026-11-22 10:10", "22.11.2026", "32.11.2026 10:10", "22.11.2026 24:00"]) {
      expect(() => parsePragueDateTime(bad)).toThrow();
    }
  });
});
