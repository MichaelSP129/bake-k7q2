#!/bin/sh
# Runs every test suite from a checkout of this repo. Usage: sh test/run_all.sh
# Needs: node 20+, python 3 with playwright, and Chrome (path in $CHROME, default /usr/bin/google-chrome).
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd); PORT=${PORT:-8810}; SRV=$(mktemp -d); ln -s "$ROOT" "$SRV/bake-k7q2"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SRV" >/dev/null 2>&1 & PID=$!
trap 'kill $PID 2>/dev/null; rm -rf "$SRV"' EXIT
sleep 1; kill -0 $PID 2>/dev/null || { echo "could not serve on port $PORT (in use? set PORT=...)"; exit 1; }
URL="http://127.0.0.1:$PORT/bake-k7q2/"
[ -f test/vendor/axe.min.js ] || sh test/fetch_axe.sh
echo "commit $(git rev-parse HEAD 2>/dev/null || echo unknown)"
FAILED=""
run(){ name=$1; shift; echo "=== $name: $*"; "$@" || FAILED="$FAILED $name"; }
run unit-qatar env TZ=Asia/Qatar node test/unit.js
run unit-london env TZ=Europe/London node test/unit.js
run pizza-qatar env TZ=Asia/Qatar node test/pizza_session.js
run pizza-london env TZ=Europe/London node test/pizza_session.js
run v21 python3 test/v21.py "$URL"
run audit21 python3 test/audit21.py "$URL"
run offline python3 test/offline.py "$URL"
run smoke python3 test/smoke.py "$URL"
if [ -n "$FAILED" ]; then echo "FAILED:$FAILED"; exit 1; fi
echo "ALL SUITES PASSED"
