import { supabaseAdmin } from "./supabase-server";

// Map our asset symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  TRX: "tron",
  LINK: "chainlink",
  SUI: "sui",
  TON: "the-open-network",
  DOT: "polkadot",
  NEAR: "near",
  APT: "aptos",
  ATOM: "cosmos",
  ALGO: "algorand",
  ICP: "internet-computer",
  FIL: "filecoin",
  HBAR: "hedera-hashgraph",
  UNI: "uniswap",
  AAVE: "aave",
  MKR: "maker",
  CRV: "curve-dao-token",
  LDO: "lido-dao",
  COMP: "compound-governance-token",
  SNX: "havven",
  RUNE: "thorchain",
  TAO: "bittensor",
  RENDER: "render-token",
  FET: "fetch-ai",
  GRT: "the-graph",
  AR: "arweave",
  AKT: "akash-network",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  BONK: "bonk",
  FLOKI: "floki",
  WIF: "dogwifcoin",
  USDT: "tether",
  USDC: "usd-coin",
  DAI: "dai",
  USDE: "ethena-usde",
};

// Fetch live crypto prices + logos from CoinGecko (free, no key needed).
// Uses /coins/markets (not /simple/price) specifically because it's the
// only endpoint that also returns each coin's official logo image.
async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, { price: number; change_percent: number; logo_url?: string }>> {
  const cryptoSymbols = symbols.filter((s) => COINGECKO_IDS[s]);
  if (cryptoSymbols.length === 0) return {};

  const ids = cryptoSymbols.map((s) => COINGECKO_IDS[s]).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`CoinGecko error: ${res.statusText}`);

  const data: any[] = await res.json();
  const byId = new Map(data.map((d) => [d.id, d]));
  const result: Record<string, { price: number; change_percent: number; logo_url?: string }> = {};

  for (const symbol of cryptoSymbols) {
    const geckoId = COINGECKO_IDS[symbol];
    const coin = byId.get(geckoId);
    if (coin) {
      result[symbol] = {
        price: coin.current_price,
        change_percent: parseFloat((coin.price_change_percentage_24h ?? 0).toFixed(2)),
        logo_url: coin.image,
      };
    }
  }
  return result;
}

// Financial Modeling Prep's ticker-keyed logo image, free and keyless.
// Verified against all 50 of our current stock tickers with 100% coverage;
// the UI's <img onError> falls back to a letter avatar for any that 404.
function stockLogoUrl(symbol: string) {
  return `https://financialmodelingprep.com/image-stock/${symbol}.png`;
}

// Fetch live stock prices from Yahoo Finance (unofficial, no key needed).
async function fetchStockPrices(symbols: string[]): Promise<Record<string, { price: number; change_percent: number; logo_url?: string }>> {
  if (symbols.length === 0) return {};

  const result: Record<string, { price: number; change_percent: number; logo_url?: string }> = {};

  // Fetch each stock in parallel
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          next: { revalidate: 0 },
        });
        if (!res.ok) return;
        const data = await res.json();
        const quote = data?.chart?.result?.[0];
        if (!quote) return;

        const closes = quote.indicators?.quote?.[0]?.close || [];
        const latest = closes[closes.length - 1];
        const prev = closes[closes.length - 2] ?? latest;
        if (!latest) return;

        result[symbol] = {
          price: parseFloat(latest.toFixed(2)),
          change_percent: parseFloat((((latest - prev) / prev) * 100).toFixed(2)),
          logo_url: stockLogoUrl(symbol),
        };
      } catch (e) {
        console.error(`Failed to fetch ${symbol}:`, e);
      }
    })
  );

  return result;
}

export async function syncAssetPrices() {
  // Fetch all assets from DB
  const { data: assets, error: assetsErr } = await supabaseAdmin
    .from("assets")
    .select("id, symbol, type");
  if (assetsErr) throw assetsErr;

  const cryptoSymbols = assets?.filter((a) => a.type === "crypto").map((a) => a.symbol) || [];
  const stockSymbols = assets?.filter((a) => a.type === "stock").map((a) => a.symbol) || [];

  // Fetch prices in parallel
  const [cryptoPrices, stockPrices] = await Promise.all([
    fetchCryptoPrices(cryptoSymbols),
    fetchStockPrices(stockSymbols),
  ]);

  const allPrices = { ...cryptoPrices, ...stockPrices };

  let updated = 0;
  let failed: string[] = [];

  // Update each asset in the DB
  await Promise.all(
    assets?.map(async (asset) => {
      const priceData = allPrices[asset.symbol];
      if (!priceData) {
        failed.push(asset.symbol);
        return;
      }
      const { error } = await supabaseAdmin
        .from("assets")
        .update({
          price: priceData.price,
          change_percent: priceData.change_percent,
          ...(priceData.logo_url ? { logo_url: priceData.logo_url } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id);

      if (error) {
        failed.push(asset.symbol);
      } else {
        updated++;
      }
    }) || []
  );

  return {
    updated,
    failed,
    timestamp: new Date().toISOString(),
  };
}
