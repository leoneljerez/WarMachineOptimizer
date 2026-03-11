#!/usr/bin/env bash
# build.sh
#
# Builds the Rust/WASM engine and copies output to js/wasm/
# Run from your project root: ./build.sh
#
# Prerequisites:
#   cargo install wasm-pack

set -e

echo "=== Building WMO WASM Engine ==="

# Build with wasm-pack (release mode, web target)
wasm-pack build --target web --release

# Create output directory if it doesn't exist
mkdir -p js/wasm

# Copy generated files to js/wasm/
cp pkg/wmo_engine.js         js/wasm/wmo_engine.js
cp pkg/wmo_engine_bg.wasm    js/wasm/wmo_engine_bg.wasm
cp pkg/wmo_engine.d.ts       js/wasm/wmo_engine.d.ts 2>/dev/null || true

echo "=== Build complete ==="
echo ""
echo "Output:"
echo "  js/wasm/wmo_engine.js        <- JS bindings (import this)"
echo "  js/wasm/wmo_engine_bg.wasm   <- WASM binary"
echo ""
echo "Your web server must serve .wasm files with Content-Type: application/wasm"
echo "If using Vite/webpack they handle this automatically."
echo "For a plain file server, see server-config notes below."
