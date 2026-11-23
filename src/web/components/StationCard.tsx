/** The selected station's card (station-detail spec; design brief §5). */
import { useState } from "preact/hooks";
import { CutThrough } from "./CutThrough.tsx";
import {
  changeText,
  flowText,
  formatDateTime,
  formatPct,
  levelSentence,
  levelText,
  volumeText,
} from "../format.ts";
import {
  DownIcon,
  ExternalIcon,
  FlatIcon,
  InfoIcon,
  LevelIcon,
  LinkIcon,
  UpIcon,
} from "../icons.tsx";
import { noteFor, shownFill, statusLabel, statusVars, type ViewStation } from "../model.ts";
import { STATION_PARAM } from "../data.ts";

const TREND = {
  up: { icon: <UpIcon />, color: "#3DB9F2" },
  down: { icon: <DownIcon />, color: "#F4B740" },
  flat: { icon: <FlatIcon />, color: "#93A7BF" },
  unknown: { icon: <FlatIcon />, color: "#93A7BF" },
};

export function StationCard({ station: s }: { station: ViewStation }) {
  const [copied, setCopied] = useState(false);
  const noData = s.status === "no-data";
  const note = noteFor(s);
  const sentence = noData ? "Aktuální hladinu neznáme" : levelSentence(s.level, s.levels.storage);
  const change = changeText(noData ? null : s.changeCm);
  const values = noData && !s.isLastKnown ? null : s;

  const copyLink = async () => {
    const url = new URL(location.origin);
    url.searchParams.set(STATION_PARAM, s.id);
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("Odkaz na tuto nádrž:", url.href);
    }
  };

  return (
    <article class="card" style={statusVars(s.status)} aria-labelledby="card-title">
      <div class="card-title">
        <div>
          <h2 id="card-title" tabIndex={-1}>
            {s.name}
          </h2>
          <span class="sub">
            {s.river} · {s.sourceName}
          </span>
        </div>
        <span class="status-chip">
          <span class="dot" aria-hidden="true" />
          {statusLabel(s.status)}
        </span>
      </div>

      <div class="fill-pct">
        <strong>{formatPct(shownFill(s))}</strong>
        <span>
          zásobního
          <br />
          prostoru
        </span>
      </div>

      <CutThrough station={s} />

      {note && (
        <p class="note">
          <InfoIcon />
          <span>{note}</span>
        </p>
      )}

      {sentence && (
        <p class="main-line">
          <LevelIcon />
          <span>{sentence}</span>
        </p>
      )}

      <dl class="values">
        <div>
          <dt>Hladina</dt>
          <dd>{levelText(values?.level ?? null)}</dd>
        </div>
        <div>
          <dt>Zásoba vody</dt>
          <dd>{volumeText(values?.storageFilled ?? null, values?.storageCapacity ?? null)}</dd>
        </div>
        <div>
          <dt>Přítok</dt>
          <dd>{flowText(values?.inflow ?? null)}</dd>
        </div>
        <div>
          <dt>Odtok</dt>
          <dd>{flowText(values?.outflow ?? null)}</dd>
        </div>
      </dl>

      <p class="trend" style={{ color: TREND[change.trend].color }}>
        {TREND[change.trend].icon}
        <span style={{ color: "#C9D8EA" }}>{change.text}</span>
      </p>

      <div class="source">
        <p>
          {s.sourceName}, s. p.
          {s.measuredAt &&
            ` · ${noData ? "poslední měření" : "měřeno"} ${formatDateTime(s.measuredAt)}`}{" "}
          · data bez záruky
        </p>
        <div class="links">
          <a class="link-btn" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalIcon />
            Živá data na webu Povodí
          </a>
          <button type="button" class="link-btn" onClick={copyLink}>
            <LinkIcon />
            {copied ? "Odkaz zkopírován" : "Odkaz na tuto nádrž"}
          </button>
        </div>
      </div>
    </article>
  );
}
