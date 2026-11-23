import { useEffect, useState } from "preact/hooks";

/** Below this width the page uses the phone layout (site-availability spec, "Responsive layout"). */
export const PHONE_QUERY = "(max-width: 640px)";

export function usePhone(): boolean {
  const query = () => typeof matchMedia === "function" && matchMedia(PHONE_QUERY).matches;
  const [phone, setPhone] = useState(query);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const list = matchMedia(PHONE_QUERY);
    const update = () => setPhone(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return phone;
}
