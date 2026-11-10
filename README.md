# receipt.is

Transaction receipt viewer for EVM chains.

## Supported chains

| Network | Route / API `chain` | Chain ID | Transaction source |
|----------|---------------------|---------:|--------------------|
| Ethereum | `eth` | 1 | Etherscan V2 |
| Base | `base` | 8453 | Etherscan V2 |
| BNB Chain | `bsc` | 56 | Etherscan V2 |
| Arbitrum One | `arb` | 42161 | Etherscan V2 |
| Optimism | `op` | 10 | Etherscan V2 |
| Lens | `lens` | 232 | Public RPC |
| Polygon | `polygon` | 137 | Public RPC |
| Avalanche C-Chain | `avalanche` | 43114 | Public RPC |
| Gnosis | `gnosis` | 100 | Public RPC |
| Mantle | `mantle` | 5000 | Public RPC |
| World Chain | `world` | 480 | Public RPC |
| Plasma | `plasma` | 9745 | Public RPC |

Use `/<chain>/<txHash>` for the receipt page or
`/api/tx/<txHash>?chain=<chain>` for JSON. Receipt defines the supported route
aliases in [`lib/chain.ts`](lib/chain.ts) and uses `web3bio-profile-kit` for
network names and chain IDs.

## Public RPC receipts

The public RPC routes work without `ETHERSCAN_API_KEY`. Lens uses
`https://rpc.lens.xyz` by default and accepts a server-side `LENS_RPC_URL`
override. The other public endpoints are listed in [`lib/evm-rpc.ts`](lib/evm-rpc.ts).

Native transfers use the transaction addresses. An ERC-20 transfer summary uses
the sender and recipient from the same receipt log as its amount. USD values are
shown when a price is available. A swap that needs internal native transfer
traces may appear as a contract call.

## Receipt cache

On Cloudflare Workers, receipt pages and the JSON API share a one-year edge
cache keyed by network and transaction hash. Successful and reverted
transactions are cached once their receipt and block are available. Pending,
missing, and errored lookups stay uncached. USD values and profile data reflect
the snapshot stored at cache fill. Each Cloudflare data center fills its own
cache and may evict entries before the TTL.

## Deploy (CI)

| Workflow | Trigger | Result |
|----------|---------|--------|
| [deploy.yml](.github/workflows/deploy.yml) | Push to `main` | Production Worker (`wrangler deploy`) |
| [preview.yml](.github/workflows/preview.yml) | PR to `main`, or push to `staging` | Preview URL (`wrangler versions upload` + alias), same as [web3bio-canary](https://github.com/web3bio/web3bio-canary) |

Preview URLs look like `https://pr-42-receipt-is.<account>.workers.dev` or `https://staging-receipt-is.<account>.workers.dev`. Enable **Preview URLs** on the Worker in the Cloudflare dashboard if links 404.

Local preview upload: `npx wrangler versions upload --keep-vars --preview-alias staging` (after `npm run staging`).

Add these [repository secrets](https://github.com/web3bio/receipt.is/settings/secrets/actions):

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts Edit** (and **Account** read) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `ETHERSCAN_API_KEY` | Etherscan API key (synced to the Worker on each deploy) |

Create a token: [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) → **Edit Cloudflare Workers** template.

Manual deploy: `npm run deploy` (after `npx wrangler login`).
