# Fire Alerts Bot

Telegram bot that sends alerts about fires near a location in Portugal using real-time data from ANEPC (Autoridade Nacional de Emergência e Proteção Civil) — the same data source used by fogosagora.pt.

Default: monitors fires within 50km of Castelo Branco.

## Setup

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather) and get the token
2. Message your bot, then get your chat ID from `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Copy `.env.example` to `.env` and fill in the values
4. Install and run:

```bash
npm install
npm start
```

## What it alerts on

- **New fires** appearing within your radius
- **Status changes** (e.g. ongoing → in resolution → concluded)
- **Resource escalation** (+5 personnel, +2 vehicles, or any aerial means added)
- **Fire resolved** notifications

## Configuration

All config via `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | — | Your Telegram chat ID |
| `MONITOR_LAT` | `39.8228` | Latitude to monitor (Castelo Branco) |
| `MONITOR_LNG` | `-7.4931` | Longitude to monitor (Castelo Branco) |
| `MONITOR_RADIUS_KM` | `50` | Alert radius in km |
| `POLL_INTERVAL_MIN` | `3` | How often to check (minutes) |

## Data source

Uses the ANEPC public API endpoint at `prociv.pt` — the same source fogosagora.pt/fogos.pt pulls from. Data updates roughly every 2 minutes on the ANEPC side.

## Running as a service

On a VPS with systemd:

```bash
# /etc/systemd/system/fire-alerts.service
[Unit]
Description=Fire Alerts Telegram Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/fire-alerts-bot
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=10
EnvironmentFile=/path/to/fire-alerts-bot/.env

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable fire-alerts
sudo systemctl start fire-alerts
```
