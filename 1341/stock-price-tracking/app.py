"""Stock Price Tracking - Flask backend using yfinance + pandas."""
import time
from datetime import datetime

import pandas as pd
import yfinance as yf
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# range key -> (yfinance period, interval)
RANGES = {
    "1D": ("1d", "5m"),
    "5D": ("5d", "30m"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y", "1d"),
    "5Y": ("5y", "1wk"),
    "MAX": ("max", "1mo"),
}

_cache = {}
TTL = 60  # seconds


def cached(key, fn):
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < TTL:
        return hit[1]
    value = fn()
    _cache[key] = (now, value)
    return value


def day_label(i_from_end, date_str):
    if i_from_end == 0:
        return f"Today ({date_str})"
    if i_from_end == 1:
        return f"Previous day ({date_str})"
    return f"{i_from_end} days ago ({date_str})"


def get_quote(symbol):
    t = yf.Ticker(symbol)
    hist = t.history(period="5d", interval="1d", auto_adjust=False)
    hist = hist.dropna(subset=["Close"])
    if hist.empty:
        raise ValueError(f"No data found for '{symbol}'")
    price = float(hist["Close"].iloc[-1])
    prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else price
    try:
        fi = t.fast_info
        price = float(fi.get("lastPrice") or price)
        prev = float(fi.get("previousClose") or prev)
        currency = fi.get("currency")
        exchange = fi.get("exchange")
    except Exception:
        currency = exchange = None
    name = None
    try:
        info = t.info
        name = info.get("longName") or info.get("shortName")
        exchange = info.get("fullExchangeName") or exchange
        currency = info.get("currency") or currency
        extra = {
            "marketCap": info.get("marketCap"),
            "peRatio": info.get("trailingPE"),
            "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "website": info.get("website"),
            "summary": info.get("longBusinessSummary"),
            "dividendYield": info.get("dividendYield"),
        }
    except Exception:
        extra = {}
    change = price - prev
    pct = (change / prev * 100) if prev else 0.0
    last = hist.iloc[-1]
    return {
        "name": name or symbol.upper(),
        "ticker": symbol.upper(),
        "exchange": exchange or "N/A",
        "currency": currency or "USD",
        "price": round(price, 2),
        "change": round(change, 2),
        "changePercent": round(pct, 2),
        "open": round(float(last["Open"]), 2),
        "dayHigh": round(float(last["High"]), 2),
        "dayLow": round(float(last["Low"]), 2),
        "volume": int(last["Volume"]) if pd.notna(last["Volume"]) else None,
        "updated": datetime.utcnow().isoformat() + "Z",
        **extra,
    }


def get_history(symbol, rng):
    period, interval = RANGES[rng]
    df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
    df = df.dropna(subset=["Close"])
    if df.empty:
        raise ValueError(f"No chart data for '{symbol}'")
    n = len(df)
    daily = interval == "1d"
    fmt = "%Y-%m-%d" if interval in ("1d", "1wk", "1mo") else "%Y-%m-%d %H:%M"
    dates = [d.strftime(fmt) for d in df.index]
    labels = (
        [day_label(n - 1 - i, d) for i, d in enumerate(dates)] if daily else dates
    )
    return {
        "range": rng,
        "interval": interval,
        "dates": dates,
        "labels": labels,
        "open": df["Open"].round(2).tolist(),
        "high": df["High"].round(2).tolist(),
        "low": df["Low"].round(2).tolist(),
        "close": df["Close"].round(2).tolist(),
        "volume": [int(v) for v in df["Volume"].fillna(0)],
    }


def symbol_arg():
    s = (request.args.get("symbol") or "AAPL").strip().upper()
    if not s or len(s) > 15:
        raise ValueError("Invalid ticker symbol")
    return s


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/quote")
def api_quote():
    try:
        s = symbol_arg()
        return jsonify(cached(("q", s), lambda: get_quote(s)))
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route("/api/history")
def api_history():
    try:
        s = symbol_arg()
        rng = (request.args.get("range") or "1M").upper()
        if rng not in RANGES:
            raise ValueError("Invalid range")
        return jsonify(cached(("h", s, rng), lambda: get_history(s, rng)))
    except Exception as e:
        return jsonify({"error": str(e)}), 404


@app.route("/healthz")
def health():
    return "ok"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
