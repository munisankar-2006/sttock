# Stock Price Tracking

A web app for tracking stock prices. Flask + yfinance + pandas on the backend; HTML5/CSS3/JavaScript and Plotly.js on the frontend.

## Features
- Stock header: company name, ticker, exchange, current price, currency, daily change, daily % change
- Tabs: Overview, Graphical Representation, Daily Prices (1 Year)
- Interactive chart with 1 Day, 5 Days, 1 Month, 3 Months, 6 Months, 1 Year, 5 Years, Max (line or candlestick, plus volume)
- 1-year header graph labelled Today / Previous day / N days ago
- Search any Yahoo Finance ticker (e.g. AAPL, MSFT, RELIANCE.NS, TCS.NS)

## Run locally
    pip install -r requirements.txt
    python app.py
    # open http://localhost:5000

## Deploy (Render, free)
1. Push this folder to a GitHub repository.
2. On https://render.com choose New > Blueprint (or Web Service) and select the repo.
3. Render reads `render.yaml`; build: `pip install -r requirements.txt`, start: `gunicorn app:app`.
4. Your public link will be `https://stock-price-tracking.onrender.com` (or similar).

`Procfile` is included for Railway/Heroku-style hosts.
