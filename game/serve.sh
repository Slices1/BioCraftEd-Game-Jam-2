#!/usr/bin/env bash
# Serve the game folder for local + LAN (phone) testing: http://<this-machine-ip>:8123/
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8123}"
echo "Serving $(pwd) on http://0.0.0.0:${PORT}/  (Ctrl+C to stop)"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
