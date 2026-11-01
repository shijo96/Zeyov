#!/bin/bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$DIR/.auto_sync.pid"
PYTHON_BIN="/opt/anaconda3/bin/python3"
SCRIPT="$DIR/scripts/auto_git_sync.py"
LOG_FILE="$DIR/scripts/auto_sync.log"

case "$1" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "Auto-sync is already running (PID: $(cat "$PID_FILE"))."
      exit 0
    fi
    echo "Starting auto-sync in background..."
    nohup "$PYTHON_BIN" "$SCRIPT" >> "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    echo "Auto-sync started with PID $PID. Logs: scripts/auto_sync.log"
    ;;
  stop)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      PID=$(cat "$PID_FILE")
      kill "$PID"
      rm -f "$PID_FILE"
      echo "Auto-sync stopped (PID: $PID)."
    else
      echo "Auto-sync is not running."
      rm -f "$PID_FILE"
    fi
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "Auto-sync is RUNNING (PID: $(cat "$PID_FILE"))."
      echo "--- Recent activity from scripts/auto_sync.log ---"
      tail -n 12 "$LOG_FILE" 2>/dev/null || echo "No activity logged yet."
    else
      echo "Auto-sync is STOPPED."
    fi
    ;;
  sync-now)
    echo "Running one-time sync..."
    "$PYTHON_BIN" "$SCRIPT" --once
    ;;
  *)
    echo "Usage: ./scripts/auto_sync.sh {start|stop|status|sync-now}"
    exit 1
    ;;
esac
