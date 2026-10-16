import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Info, RefreshCw } from "lucide-react";
import {
  getGetLaunchMarketHistoryQueryKey,
  useGetLaunchMarketHistory,
} from "@workspace/api-client-react";
import type { LaunchMarketHistory, MarketTrade } from "@workspace/api-client-react";
import { formatDateTimeUTC } from "../lib/date-format";

type Range = "1H" | "1D" | "1W" | "1M" | "ALL";
type ChartPoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const RANGE_CONFIG: Record<Range, { interval: "1m" | "15m" | "1h" | "1d"; durationMs?: number }> = {
  "1H": { interval: "1m", durationMs: 60 * 60_000 },
  "1D": { interval: "15m", durationMs: 24 * 60 * 60_000 },
  "1W": { interval: "1h", durationMs: 7 * 24 * 60 * 60_000 },
  "1M": { interval: "1d", durationMs: 30 * 24 * 60 * 60_000 },
  ALL: { interval: "1d" },
};

function formatEthPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  return value < 0.000001
    ? value.toExponential(4)
    : new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 }).format(value);
}

function formatTime(value: number, range: Range): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    ...(range === "1H" || range === "1D"
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : { month: "short", day: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

function formatFullTime(value: string | Date | number): string {
  return formatDateTimeUTC(value);
}

function tradeActor(trade: MarketTrade): string {
  return trade.traderAddress || trade.senderAddress || trade.recipientAddress || "Address not indexed";
}

function tradeAddress(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function volumeInQuote(candles: LaunchMarketHistory["candles"]): string {
  const total = candles.reduce((sum, candle) => sum + Number(candle.totalVolumeQuote), 0);
  if (!Number.isFinite(total)) return "—";
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 }).format(total);
}

function CandlestickChart({ data, range }: { data: ChartPoint[]; range: Range }) {
  const width = 960;
  const height = 250;
  const left = 82;
  const right = 12;
  const top = 12;
  const bottom = 25;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const rawLow = Math.min(...data.map((point) => point.low));
  const rawHigh = Math.max(...data.map((point) => point.high));
  const padding = rawHigh === rawLow ? Math.max(Math.abs(rawHigh) * 0.04, 1e-15) : (rawHigh - rawLow) * 0.08;
  const min = rawLow - padding;
  const max = rawHigh + padding;
  const y = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
  const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;
  const candleWidth = Math.max(1, Math.min(10, step * 0.58));
  const labelIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

  return <svg className="tt-candle-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Verified ${range} candlestick history in ETH`}>
    <title>OHLC candles from confirmed on-chain swaps. Hover or focus a candle for its values.</title>
    {[0, 1, 2, 3].map((tick) => {
      const value = max - ((max - min) * tick) / 3;
      const yPosition = y(value);
      return <g key={tick}>
        <line x1={left} x2={width - right} y1={yPosition} y2={yPosition} className="tt-candle-grid" />
        <text x={left - 8} y={yPosition + 3} textAnchor="end" className="tt-candle-label">{formatEthPrice(value)}</text>
      </g>;
    })}
    {data.map((point, index) => {
      const x = data.length === 1 ? left + plotWidth / 2 : left + index * step;
      const isUp = point.close >= point.open;
      const candleColor = isUp ? "var(--armoreum-accent-label)" : "var(--armoreum-error)";
      const bodyTop = Math.min(y(point.open), y(point.close));
      const bodyHeight = Math.max(1, Math.abs(y(point.close) - y(point.open)));
      return <g key={point.timestamp} tabIndex={0} className="tt-candle" style={{ color: candleColor }}>
        <title>{`${formatFullTime(point.timestamp)} · O ${formatEthPrice(point.open)} · H ${formatEthPrice(point.high)} · L ${formatEthPrice(point.low)} · C ${formatEthPrice(point.close)} ETH · Volume ${point.volume} ETH`}</title>
        <line x1={x} x2={x} y1={y(point.high)} y2={y(point.low)} className="tt-candle-wick" />
        <rect
          x={x - candleWidth / 2}
          y={bodyTop}
          width={candleWidth}
          height={bodyHeight}
          rx={0.7}
          className="tt-candle-body"
        />
      </g>;
    })}
    {labelIndexes.map((index) => {
      const point = data[index];
      const x = data.length === 1 ? left + plotWidth / 2 : left + index * step;
      return <text key={point.timestamp} x={x} y={height - 5} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"} className="tt-candle-label">{formatTime(point.timestamp, range)}</text>;
    })}
  </svg>;
}

export function LaunchMarketHistoryPanel({
  launchId,
  symbol,
}: {
  launchId: string;
  symbol?: string | null;
}) {
  const [range, setRange] = useState<Range>("1D");
  const [clock, setClock] = useState(() => Date.now());
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [tradePages, setTradePages] = useState<Record<string, MarketTrade[]>>({});
  const config = RANGE_CONFIG[range];
  const queryParams = useMemo(() => {
    return {
      launchId,
      interval: config.interval,
      ...(config.durationMs ? { from: new Date(clock - config.durationMs).toISOString() } : {}),
      to: new Date(clock).toISOString(),
      ...(cursorStack.length ? { tradeCursor: cursorStack[cursorStack.length - 1] } : {}),
      tradeLimit: 25,
      candleLimit: 500,
    };
  }, [launchId, config, range, cursorStack, clock]);
  const history = useGetLaunchMarketHistory(queryParams, {
    query: {
      queryKey: getGetLaunchMarketHistoryQueryKey(queryParams),
      enabled: /^0x[\da-f]{64}$/i.test(launchId),
      staleTime: 15_000,
      placeholderData: (previousData) => previousData,
    },
  });
  const pageKey = cursorStack[cursorStack.length - 1] || "__latest__";

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setCursorStack([]);
    setTradePages({});
  }, [launchId, range]);

  useEffect(() => {
    if (history.isFetching || !history.data) return;
    setTradePages((pages) => ({ ...pages, [pageKey]: history.data!.trades }));
  }, [history.data, history.isFetching, pageKey]);

  const chartData = useMemo<ChartPoint[]>(() => (history.data?.candles || [])
    .map((candle) => ({
      timestamp: new Date(candle.timestamp).getTime(),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.totalVolumeQuote),
    }))
    .filter((point) => [
      point.timestamp,
      point.open,
      point.high,
      point.low,
      point.close,
      point.volume,
    ].every(Number.isFinite)),
  [history.data?.candles]);
  const visibleTrades = [
    ...(tradePages.__latest__ || []),
    ...cursorStack.flatMap((cursor) => tradePages[cursor] || []),
  ];
  const response = history.data;
  const olderAvailable = Boolean(response?.nextTradeCursor);
  const status = response?.dataStatus || (history.isError ? "unavailable" : "indexing");

  return <>
    <section className="tt-panel">
      <div className="tt-chart-top">
        <div className="tt-chart-title">
          <div className="tt-section-head" style={{ marginBottom: 0 }}>
            <div><h2>Market overview</h2><p>{symbol ? `${symbol} · ` : ""}Confirmed on-chain swaps · price in ETH · Time shown in UTC</p></div>
          </div>
        </div>
        <div className="tt-market-controls">
          <div className="tt-intervals" aria-label="Chart interval">
            {(Object.keys(RANGE_CONFIG) as Range[]).map((item) => (
              <button
                className={range === item ? "selected" : ""}
                type="button"
                aria-pressed={range === item}
                key={item}
                onClick={() => setRange(item)}
              >{item}</button>
            ))}
          </div>
          <button
            className="tt-refresh"
            type="button"
            onClick={() => void history.refetch()}
            aria-label="Refresh market history"
            title="Refresh market history"
          ><RefreshCw size={13} className={history.isFetching ? "is-spinning" : ""} /></button>
        </div>
      </div>

      {history.isLoading ? (
        <div className="tt-chart-empty"><div><span className="tt-chart-icon"><RefreshCw size={18} /></span><strong>Loading confirmed trade history</strong><p>Reading indexed Robinhood swap events.</p></div></div>
      ) : history.isError ? (
        <div className="tt-chart-empty" role="status"><div><span className="tt-chart-icon"><Info size={18} /></span><strong>Market history is temporarily unavailable</strong><p>No estimated or fabricated prices are shown. Retry the indexed data request.</p><button className="button button-secondary compact" type="button" onClick={() => void history.refetch()}>Retry</button></div></div>
      ) : chartData.length === 0 ? (
        <div className="tt-chart-empty"><div><span className="tt-chart-icon"><Info size={18} /></span><strong>{status === "indexing" ? "Trade history is indexing" : "No confirmed swaps in this range"}</strong><p>{status === "indexing" ? "The chart will fill as confirmed on-chain events are indexed." : "This range contains no indexed Pons curve or Uniswap V4 swaps."}</p></div></div>
      ) : (
        <div className="tt-chart-wrap"><CandlestickChart data={chartData} range={range} /></div>
      )}
      <div className="tt-market-foot">
        <span>Source: <strong>{response?.source || "Verified chain index"}</strong></span>
        <span>{response?.lastIndexedAt ? `Indexed ${formatFullTime(response.lastIndexedAt)}` : status}</span>
      </div>
    </section>

    <section className="tt-panel">
      <div className="tt-section-head tt-trades-heading">
        <div><h2>Recent swaps</h2><p>Confirmed Pons curve and Uniswap V4 swaps · volume {volumeInQuote(response?.candles || [])} ETH for this range</p></div>
        <span className={`tt-index-status is-${status}`}>{status}</span>
      </div>
      {history.isError ? (
        <div className="tt-activity-note"><Info size={16} /><span>Swap data could not be loaded from the verified history index.</span></div>
      ) : visibleTrades.length === 0 ? (
        <div className="tt-empty-inline">{history.isLoading ? "Loading indexed swaps…" : "No confirmed swaps have been indexed for this launch yet."}</div>
      ) : (
        <>
          <div className="tt-trades-scroll">
            <table className="tt-trades-table">
              <thead><tr><th>Time (UTC)</th><th>Side</th><th>Price (ETH)</th><th>Amount</th><th>Value</th><th>Trader / sender</th></tr></thead>
              <tbody>{visibleTrades.map((trade) => <tr key={trade.id}>
                <td>{formatFullTime(trade.timestamp)}</td>
                <td><span className={`tt-trade-side is-${trade.side}`}>{trade.side === "buy" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}{trade.side}</span></td>
                <td className="mono">{formatEthPrice(Number(trade.executionPriceNative))}</td>
                <td>{trade.tokenAmount} {symbol || "tokens"}</td>
                <td>{trade.quoteAmount} {trade.quoteAssetSymbol}</td>
                <td><a className="tt-trader-link mono" href={trade.explorerUrl} target="_blank" rel="noreferrer" title={tradeActor(trade)}>{tradeAddress(tradeActor(trade))}<ExternalLink size={11} /></a></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="tt-trades-pagination">
            <button
              className="button button-secondary compact"
              type="button"
              disabled={cursorStack.length === 0}
              onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
            >Newer swaps</button>
            <button
              className="button button-secondary compact"
              type="button"
              disabled={!olderAvailable || history.isFetching}
              onClick={() => response?.nextTradeCursor && setCursorStack((stack) => [...stack, response.nextTradeCursor!])}
            >Load older swaps</button>
          </div>
        </>
      )}
    </section>
  </>;
}
