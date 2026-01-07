#!/bin/bash

PID_FILE=".daemon.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "デーモンは既に起動しています (PID: $PID)"
    exit 1
  else
    echo "古いPIDファイルを削除します"
    rm "$PID_FILE"
  fi
fi

echo "デーモンを起動しています..."
nohup node dist/daemon.js > /dev/null 2>&1 &

sleep 1

if [ -f "$PID_FILE" ]; then
  echo "デーモンが起動しました (PID: $(cat $PID_FILE))"
else
  echo "デーモンの起動に失敗しました"
  exit 1
fi
