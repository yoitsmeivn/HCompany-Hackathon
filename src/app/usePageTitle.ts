import { useEffect } from "react";

const DEFAULT_TITLE = "Kylian — Your computer, available wherever you are";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — Kylian` : DEFAULT_TITLE;
  }, [title]);
}
