import { CONTACT_EMAIL } from "../../scraper/config.ts";

export function Footer() {
  return (
    <footer class="site-footer">
      <p>
        Data: státní podniky Povodí Vltavy, Labe, Ohře, Moravy a Odry · aktualizace jednou denně ·
        provozní data bez záruky. <a href="/metodika/">Jak data vznikají a co znamenají barvy</a>
      </p>
      <p>
        Neoficiální projekt, nejde o službu státních podniků Povodí ani státu. Kontakt:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </footer>
  );
}
