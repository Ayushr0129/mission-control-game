#!/usr/bin/env bash
# Runs GMAT scripts from this folder and, when run with no arguments, collects the results into the game's data.
#   bash gmat/run.sh            every mission script and apollo11, then npm run gmat:collect
#   bash gmat/run.sh moon       only that script, no collection
# GMAT is looked for in $GMAT_HOME (default ~/opt/gmat/GMAT/R2026a); see gmat/README.md.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
GMAT_HOME="${GMAT_HOME:-$HOME/opt/gmat/GMAT/R2026a}"
console="$GMAT_HOME/bin/GmatConsole"
[ -x "$console" ] || { echo "GMAT console not found at $console; set GMAT_HOME (see gmat/README.md)" >&2; exit 1; }
mkdir -p "$here/output"

all=0; names=("$@")
if [ ${#names[@]} -eq 0 ]; then all=1; names=(earth moon apollo11); fi

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
for n in "${names[@]}"; do
  [ -f "$here/$n.script" ] || { echo "no such script: gmat/$n.script" >&2; exit 1; }
  rm -f "$here/output/$n.txt"
  sed "s#@OUT@#$here/output#g" "$here/$n.script" > "$work/$n.script"
  echo "== GMAT $n"
  # GMAT finds its data files relative to its bin folder, so it runs from there
  (cd "$GMAT_HOME/bin" && ./GmatConsole --verbose off --run "$work/$n.script") > "$work/$n.log" 2>&1 || true
  if [ ! -s "$here/output/$n.txt" ]; then
    echo "GMAT produced no report for $n. Its errors:" >&2
    grep -i -A2 "exception\|\*\*\*\* error" "$work/$n.log" | grep -v -i -E "libmex|MatlabInterface|OpenFrames|OVtoOFI" | head -20 >&2 || tail -25 "$work/$n.log" >&2
    exit 1
  fi
  grep -i -E "did not converge|error|failed" "$work/$n.log" | grep -v -i -E "libmex|MatlabInterface|OpenFrames|OVtoOFI" >&2 && { echo "GMAT reported a problem in $n (see above)" >&2; exit 1; } || true
  cat "$here/output/$n.txt"
done

if [ $all -eq 1 ]; then (cd "$here/.." && npm run -s gmat:collect); fi
