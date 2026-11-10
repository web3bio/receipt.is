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
| Lens | `lens` | 232 | Lens RPC |

Use `/<chain>/<txHash>` for the receipt page or
`/api/tx/<txHash>?chain=<chain>` for JSON. Receipt defines the supported route
aliases in [`lib/chain.ts`](lib/chain.ts) and uses `web3bio-profile-kit` for
network names and chain IDs.

## Lens

Lens mainnet (`lens`, chain ID 232) uses the same receipt page and API as the
other chains: `/lens/<txHash>` and `/api/tx/<txHash>?chain=lens`.

The default RPC is `https://rpc.lens.xyz`. Set the server-side `LENS_RPC_URL`
to override it. Lens does not use `ETHERSCAN_API_KEY`. Native transfers are shown
in GHO; ERC-20 transfers come from receipt logs. Swaps that require internal
native transfer traces may be shown as regular contract calls.

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
