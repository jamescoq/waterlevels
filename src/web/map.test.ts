import { describe, expect, it } from "vitest";
import { cityLabelBox, collides } from "./components/MapPanel.tsx";

const station = (name: string, x: number, y: number, r: number) => ({ name, desktop: { x, y, r } });

describe("city labels give way (station-map spec, Labels)", () => {
  const city = { x: 100, y: 100 };

  it("keeps a label with nothing nearby", () => {
    expect(
      collides(cityLabelBox(city, { label: "Praha" }), [station("VD Daleko", 300, 300, 10)]),
    ).toBe(false);
  });

  it("gives way to a circle under the label", () => {
    expect(
      collides(cityLabelBox(city, { label: "Praha" }), [station("VD Blízko", 115, 92, 9)]),
    ).toBe(true);
  });

  it("gives way to the name shown below a large circle", () => {
    // A 40 px circle just above the label: its name is drawn under it, across the label.
    expect(
      collides(cityLabelBox(city, { label: "Praha" }), [station("VD Velká nádrž", 120, 60, 20)]),
    ).toBe(true);
  });

  it("places an end-anchored label to the left of the dot", () => {
    const box = cityLabelBox(city, { label: "Ostrava", end: true });
    expect(box.right).toBe(95);
    expect(box.left).toBeLessThan(95);
  });
});
