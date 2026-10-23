#!/bin/sh
# Downloads the pinned axe-core used by test/audit21.py into test/vendor/ (gitignored) and checks its SHA-256.
set -eu
cd "$(dirname "$0")"
mkdir -p vendor
curl -fsSL https://cdn.jsdelivr.net/npm/axe-core@4.10.3/axe.min.js -o vendor/axe.min.js
echo "880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb  vendor/axe.min.js" | sha256sum -c -
