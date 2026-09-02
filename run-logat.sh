#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="$SCRIPT_DIR/native${PYTHONPATH:+:$PYTHONPATH}"
PYTHON="$SCRIPT_DIR/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then PYTHON=python3; fi
exec "$PYTHON" "$SCRIPT_DIR/app.py" "$@"
