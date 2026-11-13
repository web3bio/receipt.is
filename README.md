# receipt.is

Transaction receipt viewer for EVM and other blockchain networks.

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
| Unichain | `unichain` | 130 | Public RPC |
| Scroll | `scroll` | 534352 | Public RPC |
| Linea | `linea` | 59144 | Public RPC |
| ZKsync Era | `zksync` | 324 | Public RPC |
| Abstract | `abstract` | 2741 | Public RPC |
| Zora | `zora` | 7777777 | Public RPC |
| Arbitrum Nova | `nova` | 42170 | Public RPC |
| X Layer | `xlayer` | 196 | Public RPC |
| ApeChain | `apechain` | 33139 | Public RPC |
| Flow EVM | `flow` | 747 | Public RPC |
| Fantom Opera | `fantom` | 250 | Public RPC |
| Conflux eSpace | `conflux` | 1030 | Public RPC |

Use `/<chain>/<txHash>` for the receipt page or
`/api/tx/<txHash>?chain=<chain>` for JSON. Receipt defines the supported route
aliases in [`lib/chain.ts`](lib/chain.ts) and uses `web3bio-profile-kit` for
network names, chain IDs, native symbols, explorer links, colors, and public RPC defaults.

## Public RPC receipts

The public RPC routes work without `ETHERSCAN_API_KEY`. Lens uses
`https://rpc.lens.xyz` by default and accepts a server-side `LENS_RPC_URL`
override. Public EVM endpoints come from `NETWORK_DATA` in the kit.

Native transfers use the transaction addresses. An ERC-20 transfer summary uses
the sender and recipient from the same receipt log as its amount. USD values are
shown when a price is available. A swap that needs internal native transfer
traces may appear as a contract call.

For local development before the updated kit is published, build and pack the
kit from its checkout, then install the tarball in Receipt with
`npm install --no-save --package-lock=false /path/to/web3bio-profile-kit.tgz`.
Update the Receipt dependency and lockfiles after the kit is released.

## Networks with their own transaction format

Use the same routes with the network's transaction ID. Solana accepts a
case-sensitive signature on `/solana/<signature>` or `/sol/<signature>`.
NEAR, Sui and Arweave IDs also preserve case.

| Network | Route | Data source and display |
|---------|-------|-------------------------|
| Bitcoin | `bitcoin`, `btc` | Esplora inputs, outputs, confirmations and fee |
| Litecoin, Dogecoin | `litecoin`, `dogecoin` | BlockCypher inputs, outputs, confirmations and fee |
| TRON | `tron` | FullNode and SolidityNode. TRX and USDT transfers |
| Aptos | `aptos` | Aptos REST. Direct APT transfers, status and gas |
| XRP Ledger | `xrpl` | XRPL JSON-RPC. Payments using the amount actually delivered |
| Sui | `sui` | Sui GraphQL. Direct SUI transfers from the gas coin, balance changes, status and gas |
| Starknet | `starknet` | Starknet RPC. ETH and STRK transfer events |
| TON | `ton` | TON Center. TON and Jetton actions |
| NEAR | `near` | FastNear transaction index. Direct NEAR transfers and execution status |
| Arweave | `arweave` | Arweave node. AR transfers and data transaction summaries |
| Solana | `solana`, `sol` | Solana RPC. SOL, SPL Token and Token-2022 transfer instructions |

A native network's provider URL can be overridden with
`<ROUTE>_RECEIPT_URL`, for example `SOLANA_RECEIPT_URL`. Keep the expected
API path and response format when setting an override.

## Receipt cache

On Cloudflare Workers, receipt pages and the JSON API share a one-year edge
cache keyed by network and transaction hash. Successful and reverted
EVM transactions are cached once their receipt and block are available. Other
networks cache results when their data source provides finality or sufficient
confirmation depth. Pending,
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
