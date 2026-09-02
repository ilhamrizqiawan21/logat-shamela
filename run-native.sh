#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="$ROOT/native${PYTHONPATH:+:$PYTHONPATH}"
export LOGAT_SYAMILAH_RESOURCE_DIR="$ROOT"
export SHAMELA_INSTALL_ROOT="$(dirname "$ROOT")"
exec python3 -m logat_syamilah "$@"
