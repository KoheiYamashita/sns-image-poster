#!/bin/bash

PID_FILE=".daemon.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "デーモンは起動していません"
  exit 0
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
  echo "デーモンを停止しています (PID: $PID)..."
  kill "$PID"

  # 終了を待つ
  for i in {1..10}; do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi
    sleep 0.5
  done

  # まだ動いていたら強制終了
  if kill -0 "$PID" 2>/dev/null; then
    echo "強制終了します..."
    kill -9 "$PID"
  fi

  echo "デーモンを停止しました"
else
  echo "デーモンは既に停止しています"
fi

# PIDファイルを削除
if [ -f "$PID_FILE" ]; then
  rm "$PID_FILE"
fi
