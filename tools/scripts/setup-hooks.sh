#!/usr/bin/env bash
# Configure Claude Code hooks to send events to the local telemetry bridge
set -e

BRIDGE_URL="${AMC_BRIDGE_URL:-http://localhost:4700}"

echo "Agent Mission Control - Hook Setup"
echo "==================================="
echo "Bridge URL: $BRIDGE_URL"
echo ""

# Check if bridge is running
if curl -s "$BRIDGE_URL/api/health" > /dev/null 2>&1; then
  echo "Bridge is running and reachable."
else
  echo "WARNING: Bridge is not reachable at $BRIDGE_URL"
  echo "Make sure to start it with: npm run dev --workspace=packages/telemetry-bridge"
fi

echo ""
echo "To connect Claude Code to Agent Mission Control, configure your hooks"
echo "to POST events to: $BRIDGE_URL/api/collect/claude-code"
echo ""
echo "Example hook configuration:"
echo '  {"type": "http", "url": "'$BRIDGE_URL'/api/collect/claude-code", "timeout": 5}'
