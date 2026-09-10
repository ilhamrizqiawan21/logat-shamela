#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="$SCRIPT_DIR/native${PYTHONPATH:+:$PYTHONPATH}"
PYTHON="$SCRIPT_DIR/.venv/bin/python"
if [[ -x "$SCRIPT_DIR/.venv-wsl/bin/python" ]]; then PYTHON="$SCRIPT_DIR/.venv-wsl/bin/python"; fi
if [[ ! -x "$PYTHON" ]]; then PYTHON=python3; fi
if [[ -z "${SHAMELA_INSTALL_ROOT:-}" && -f "$SCRIPT_DIR/../database/master.db" && -d "$SCRIPT_DIR/../app/lucene/2" ]]; then
    export SHAMELA_INSTALL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
if [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
    echo "Buka http://127.0.0.1:8765 di browser Windows (port default)."
    set -- --no-browser "$@"
fi
exec "$PYTHON" "$SCRIPT_DIR/app.py" "$@"
