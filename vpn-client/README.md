# StealthVPN Desktop

Opens the VPN dashboard as a native Windows application (no browser needed).

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
python main.py
```

That's it. The dashboard opens in a native window.

## What It Does

1. Checks if `npm run dev` is already running on port 3000
2. If not, starts it automatically in the background
3. Opens a native Windows window pointing to the dashboard
4. When you close the window, the server stops too

## Requirements

- Python 3.10+
- Node.js (for the dashboard)
- All npm packages installed (`npm install` in the dashboard folder)