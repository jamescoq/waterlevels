/**
 * public/map/geometry.json: the map's vector layers, already projected into the 880 px desktop
 * frame (design.md Decision 5). The phone map draws the same paths scaled to its width.
 */

export type RiverWeight = 1 | 2 | 3;

export interface MapGeometry {
  schemaVersion: 1;
  /** Frame size in px; paths use these coordinates. */
  width: number;
  height: number;
  /** SVG path of Czechia's border. */
  border: string;
  /** SVG paths of the rivers, one per weight. */
  rivers: {
    /** Main rivers (150 km and longer). */
    main: string;
    /** Tributaries (40–150 km), and connectors of that length. */
    tributary: string;
    /** Streams feeding registered reservoirs, and short connectors. */
    feeder: string;
  };
  /** City dots, largest first. */
  cities: { name: string; x: number; y: number }[];
}
