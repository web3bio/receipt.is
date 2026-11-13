import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { getReceiptNetwork, SUPPORTED_CHAINS } from "./lib/chain";

const resolve = createRequire(join(process.cwd(), "package.json")).resolve;
const iconDirectory = join(process.cwd(), "public", "kit", "icons");
rmSync(iconDirectory, { recursive: true, force: true });
mkdirSync(iconDirectory, { recursive: true });

const icons = new Set(SUPPORTED_CHAINS.map(chain => getReceiptNetwork(chain)?.icon));
for (const icon of icons) {
  if (!icon) continue;
  copyFileSync(resolve(`web3bio-profile-kit/${icon}`), join(iconDirectory, icon.slice("icons/".length)));
}

const nextConfig: NextConfig = {};

export default nextConfig;

initOpenNextCloudflareForDev();
