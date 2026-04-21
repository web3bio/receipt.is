import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { parseBlockTimestampSeconds } from "./utils";

/** 相对时间（如 `3 hours ago`）；仅客户端 / 需 date-fns 的代码应从此模块导入，避免服务端无关 bundle 膨胀。 */
export function formatBlockTimestampRelative(timestampHexOrUnix?: string): string {
  const sec = parseBlockTimestampSeconds(timestampHexOrUnix);
  if (sec == null) return "-";
  return formatDistanceToNow(new Date(sec * 1000), {
    addSuffix: true,
    locale: enUS,
  });
}
