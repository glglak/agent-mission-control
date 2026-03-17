#!/usr/bin/env bash
# Start both the telemetry bridge and web UI in development mode
set -e

cd "$(dirname "$0")/../.."

echo "Building shared package..."
npm run build --workspace=packages/shared

echo "Starting telemetry bridge and web UI..."
npx turbo dev --filter=@amc/telemetry-bridge --filter=@amc/web
