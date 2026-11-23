import { formatDateTime } from "../format.ts";
import { Logo } from "../icons.tsx";

/** Wordmark; the final display name is still an open question (design.md). */
export const SITE_NAME = "Stav nádrží";

export function Header({ lastSuccessfulFetch }: { lastSuccessfulFetch: string | null }) {
  return (
    <header class="site-header">
      <div class="brand">
        <Logo />
        <span>{SITE_NAME}</span>
      </div>
      {lastSuccessfulFetch && (
        <p class="header-meta" style={{ margin: 0 }}>
          Aktualizováno {formatDateTime(lastSuccessfulFetch)}
        </p>
      )}
    </header>
  );
}
