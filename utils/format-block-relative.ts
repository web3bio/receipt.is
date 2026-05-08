import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { parseBlockTimestampSeconds } from "./utils";

/** Relative label (e.g. `3 hours ago`). Import here on the client only to keep server bundles slim. */
export function formatBlockTimestampRelative(timestampHexOrUnix?: string): string {
  const sec = parseBlockTimestampSeconds(timestampHexOrUnix);
  if (sec == null) return "-";
  return formatDistanceToNow(new Date(sec * 1000), {
    addSuffix: true,
    locale: enUS,
  });
}
