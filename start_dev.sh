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
SPINDLY_DIR="$SCRIPT_DIR/src_new/spindly.app"
TICKETING_DIR="$SCRIPT_DIR/src_new/ticketing-app"

API_LOG="$SCRIPT_DIR/dev_api.log"
WEB_LOG="$SCRIPT_DIR/dev_web.log"
WEB_SUBBRAND_LOG="$SCRIPT_DIR/dev_web_subbrand.log"
NGROK_LOG="$SCRIPT_DIR/dev_ngrok.log"
SPINDLY_LOG="$SCRIPT_DIR/dev_spindly.log"
TICKETING_LOG="$SCRIPT_DIR/dev_ticketing.log"

SMEE_URL="https://smee.io/CmkvBO6jTmDcCFbc"
NGROK_DOMAIN="$1"

# Clear log files (fresh start)
> "$API_LOG"
> "$WEB_LOG"
> "$WEB_SUBBRAND_LOG"
> "$NGROK_LOG"
> "$SPINDLY_LOG"
> "$TICKETING_LOG"

echo "Starting development services..."
echo "API logs:           $API_LOG"
echo "Web logs:           $WEB_LOG"
echo "Web subbrand logs:  $WEB_SUBBRAND_LOG"
echo "Ngrok logs:         $NGROK_LOG"
echo "Spindly logs:       $SPINDLY_LOG"
echo "Ticketing logs:     $TICKETING_LOG"

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

# Start smee webhook proxy (forwards PayMongo webhooks to local API)
echo "Starting smee webhook proxy..."
npx smee -u "$SMEE_URL" -t http://127.0.0.1:3000/api/public/webhook/payment > "$SMEE_LOG" 2>&1 &
SMEE_PID=$!
echo "Smee proxy started (PID: $SMEE_PID)"

# Start API server
echo "Starting API server..."
cd "$API_DIR"
npm run dev > "$API_LOG" 2>&1 &
API_PID=$!
echo "API server started (PID: $API_PID)"

# Start Web server (use local config with ngrok to point API at the tunnel)
echo "Starting Web server (localhost:80)..."
cd "$WEB_DIR"
if [ -n "$NGROK_DOMAIN" ]; then
    NO_COLOR=1 npx ng serve -c local --host localhost --port 80 > "$WEB_LOG" 2>&1 &
else
    NO_COLOR=1 npx ng serve --host localhost --port 80 > "$WEB_LOG" 2>&1 &
fi
WEB_PID=$!
echo "Web server started (PID: $WEB_PID)"

# Start second Web server instance for subbrand
echo "Starting Web server subbrand (localhost.subbrand:80)..."
cd "$WEB_DIR"
if [ -n "$NGROK_DOMAIN" ]; then
    NO_COLOR=1 npx ng serve -c local --host localhost.subbrand --port 80 > "$WEB_SUBBRAND_LOG" 2>&1 &
else
    NO_COLOR=1 npx ng serve --host localhost.subbrand --port 80 > "$WEB_SUBBRAND_LOG" 2>&1 &
fi
WEB_SUBBRAND_PID=$!
echo "Web server subbrand started (PID: $WEB_SUBBRAND_PID)"

# Start Spindly public site
echo "Starting Spindly public site..."
cd "$SPINDLY_DIR"
NO_COLOR=1 npx ng serve --port 1234 > "$SPINDLY_LOG" 2>&1 &
SPINDLY_PID=$!
echo "Spindly site started (PID: $SPINDLY_PID)"

# Start ticketing app organizer portal
echo "Starting ticketing app organizer portal..."
cd "$TICKETING_DIR"
npx ng serve --port 4201 --configuration=local > "$TICKETING_LOG" 2>&1 &
TICKETING_PID=$!
echo "Ticketing app portal started (PID: $TICKETING_PID)"

echo ""
echo "All services started!"
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C to kill all background processes
cleanup() {
    echo ""
    echo "Stopping all services..."
    [ -n "$SMEE_PID" ] && kill $SMEE_PID 2>/dev/null
    [ -n "$NGROK_PID" ] && kill $NGROK_PID 2>/dev/null
    [ -n "$API_PID" ] && kill $API_PID 2>/dev/null
    [ -n "$WEB_PID" ] && kill $WEB_PID 2>/dev/null
    [ -n "$WEB_SUBBRAND_PID" ] && kill $WEB_SUBBRAND_PID 2>/dev/null
    [ -n "$SPINDLY_PID" ] && kill $SPINDLY_PID 2>/dev/null
    [ -n "$TICKETING_PID" ] && kill $TICKETING_PID 2>/dev/null
    echo "All services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any process to exit
wait
