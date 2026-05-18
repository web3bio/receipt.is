import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { parseBlockTimestampSeconds } from "./utils";

export function formatBlockTimestampRelative(timestampHexOrUnix?: string): string {
  const sec = parseBlockTimestampSeconds(timestampHexOrUnix);
  if (sec == null) return "-";
  return formatDistanceToNow(new Date(sec * 1000), {
    addSuffix: true,
    locale: enUS,
  });
}
