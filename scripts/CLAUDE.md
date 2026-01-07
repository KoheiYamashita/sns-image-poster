# scripts/

デーモン（定期実行）管理用シェルスクリプト。

## ファイル

- `daemon-start.sh` - デーモン起動
- `daemon-stop.sh` - デーモン停止

## daemon-start.sh

デーモンモードでアプリケーションを起動。

```bash
./scripts/daemon-start.sh
```

- PIDファイル: `daemon.pid`
- ログファイル: `logs/daemon.log`
- バックグラウンドでnohup実行

## daemon-stop.sh

デーモンを停止。

```bash
./scripts/daemon-stop.sh
```

- PIDファイルからプロセスを特定して終了

## 定期実行の設定

環境変数で実行時刻を設定：

```
SCHEDULE_TIMES=08:00,12:00,18:00
```
