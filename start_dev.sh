#!/bin/bash

# Development startup script
# Starts all local development services with logging
#
# Usage: ./start_dev.sh [ngrok-domain]
#   ngrok-domain: your free static domain (e.g. abc123.ngrok-free.app)
#                 Get one at https://dashboard.ngrok.com/domains

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/src_new/label-dashboard-api"
WEB_DIR="$SCRIPT_DIR/src_new/label-dashboard-web"

API_LOG="$SCRIPT_DIR/dev_api.log"
WEB_LOG="$SCRIPT_DIR/dev_web.log"
NGROK_LOG="$SCRIPT_DIR/dev_ngrok.log"

NGROK_DOMAIN="$1"

# Clear log files (fresh start)
> "$API_LOG"
> "$WEB_LOG"
> "$NGROK_LOG"

echo "Starting development services..."
echo "API logs:   $API_LOG"
echo "Web logs:   $WEB_LOG"
echo "Ngrok logs: $NGROK_LOG"

# Start ngrok tunnel
if [ -n "$NGROK_DOMAIN" ]; then
    if ! command -v ngrok &> /dev/null; then
        echo ""
        echo "ngrok not found. Install it:"
        echo "  npm install -g ngrok   OR   https://ngrok.com/download"
        echo "Then run: ngrok config add-authtoken <your-token>"
        echo ""
        echo "Continuing without ngrok (transfer callbacks won't work)..."
    else
        API_PORT=3000

        echo "Starting ngrok tunnel (domain: $NGROK_DOMAIN)..."
        ngrok http --url="$NGROK_DOMAIN" "$API_PORT" --log=stdout > "$NGROK_LOG" 2>&1 &
        NGROK_PID=$!

        # Wait for ngrok to establish the tunnel
        for i in {1..10}; do
            sleep 1
            NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
            if [ -n "$NGROK_URL" ]; then
                break
            fi
        done

        if [ -n "$NGROK_URL" ]; then
            echo ""
            echo "=========================================="
            echo "  Ngrok URL: $NGROK_URL"
            echo "=========================================="
            echo ""
            echo "Make sure this domain is added to your brand in the dashboard."
        else
            echo "Warning: ngrok started but could not retrieve URL. Check $NGROK_LOG"
        fi
    fi
else
    echo ""
    echo "No ngrok domain specified — skipping ngrok."
    echo "Usage: ./start_dev.sh your-domain.ngrok-free.app"
    echo ""
fi

# Start API server
echo "Starting API server..."
cd "$API_DIR"
npm run dev > "$API_LOG" 2>&1 &
API_PID=$!
echo "API server started (PID: $API_PID)"

# Start Web server (use local config with ngrok to point API at the tunnel)
echo "Starting Web server..."
cd "$WEB_DIR"
if [ -n "$NGROK_DOMAIN" ]; then
    npx ng serve -c local > "$WEB_LOG" 2>&1 &
else
    npm start > "$WEB_LOG" 2>&1 &
fi
WEB_PID=$!
echo "Web server started (PID: $WEB_PID)"

echo ""
echo "All services started!"
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C to kill all background processes
cleanup() {
    echo ""
    echo "Stopping all services..."
    [ -n "$NGROK_PID" ] && kill $NGROK_PID 2>/dev/null
    [ -n "$API_PID" ] && kill $API_PID 2>/dev/null
    [ -n "$WEB_PID" ] && kill $WEB_PID 2>/dev/null
    echo "All services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any process to exit
wait
