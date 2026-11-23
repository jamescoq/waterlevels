import { statusVars } from "../model.ts";
import { headlineText, type Headline } from "../../shared/headline.ts";
import type { Status } from "../../shared/status.ts";

const CHIPS: { label: string; status: Status; count: (h: Headline) => number }[] = [
  {
    label: "nad zásobní hladinou",
    status: "above-storage",
    count: (h) => h.statusCounts["above-storage"],
  },
  { label: "vysoká zásoba", status: "high", count: (h) => h.statusCounts.high },
  { label: "střední zásoba", status: "medium", count: (h) => h.statusCounts.medium },
  { label: "nízká zásoba", status: "low", count: (h) => h.statusCounts.low },
  { label: "mimo hodnocení", status: "planned", count: (h) => h.outsideRating },
];

export function Hero({ headline }: { headline: Headline }) {
  const text = headlineText(headline);
  const outside = headline.statusCounts;
  return (
    <section class="hero" aria-labelledby="headline">
      <p class="eyebrow">Zásoby vody v nádržích ČR</p>
      <h1 id="headline">
        {headline.rated === 0 ? (
          text.main
        ) : (
          <>
            V{" "}
            <span class="accent">
              {headline.high} z {headline.total}
            </span>{" "}
            nádrží je zásoba vody nad 70&nbsp;%
          </>
        )}
      </h1>
      <p>
        {text.weighted ? `${text.weighted} ` : ""}
        Najetím na kruh zobrazíte náhled, kliknutím otevřete řez hrází. Všechny nádrže najdete také
        v seznamu vedle mapy.
      </p>
      <ul class="chips" aria-label="Počty nádrží podle stavu">
        {CHIPS.map((chip) => (
          <li
            key={chip.label}
            class="chip"
            title={
              chip.status === "planned"
                ? `${outside["no-data"]} bez dat, ${outside.planned} plánované snížení, ${outside["level-only"]} jen hladina`
                : undefined
            }
          >
            <span class="dot" style={statusVars(chip.status)} aria-hidden="true" />
            <span>
              <strong>{chip.count(headline)}</strong> {chip.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
