#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Run the independent sympy oracle. Uses tools/oracle/.venv when present,
# otherwise python3 (CI installs sympy into the selected interpreter and sets
# SUMSTAIR_PYTHON).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
if [[ -n "${SUMSTAIR_PYTHON:-}" ]]; then
  py="$SUMSTAIR_PYTHON"
elif [[ -x tools/oracle/.venv/bin/python ]]; then
  py="tools/oracle/.venv/bin/python"
else
  py="python3"
fi
tsx tools/oracle/dump.ts | "$py" tools/oracle/check.py
