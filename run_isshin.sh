#!/bin/bash
# isshin アカウント用 reserve.py 実行スクリプト

# ---- パス類 ----
export HOME="${HOME:-/home/osatoosi3104}"
export PATH="$HOME/miniforge3/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

PROJECT_DIR="/home/osatoosi3104/sato4.jp/public_html/ishi"
LOG_FILE="$PROJECT_DIR/reserve_isshin.log"
CONDA_DIR="$HOME/miniforge3"
ENV_NAME="ishi"
ENV_PY="$CONDA_DIR/envs/$ENV_NAME/bin/python"

echo "=== Cron Job Started at $(date) ===" >> "$LOG_FILE"
cd "$PROJECT_DIR" || exit 1

# ---- conda 環境を作成 (なければ) ----
if [ ! -x "$ENV_PY" ]; then
    if [ ! -x "$CONDA_DIR/bin/conda" ]; then
        echo "ERROR: Miniforge not found at $CONDA_DIR" >> "$LOG_FILE"
        echo "=== Cron Job Finished at $(date) ===" >> "$LOG_FILE"
        exit 1
    fi
    echo "Creating conda env '$ENV_NAME' ..." >> "$LOG_FILE"
    "$CONDA_DIR/bin/conda" create -n "$ENV_NAME" -y -c conda-forge \
        python=3.12 requests beautifulsoup4 python-dotenv >> "$LOG_FILE" 2>&1
fi

# ---- 必要モジュールが入っているか検証 / 不足分は conda で補う ----
if ! "$ENV_PY" -c 'import requests, bs4, dotenv' >/dev/null 2>&1; then
    echo "Installing missing packages via conda ..." >> "$LOG_FILE"
    "$CONDA_DIR/bin/conda" install -n "$ENV_NAME" -y -c conda-forge \
        requests beautifulsoup4 python-dotenv >> "$LOG_FILE" 2>&1
fi

if ! "$ENV_PY" -c 'import requests, bs4, dotenv' >/dev/null 2>&1; then
    echo "ERROR: required Python modules are still missing." >> "$LOG_FILE"
    "$CONDA_DIR/bin/conda" list -n "$ENV_NAME" >> "$LOG_FILE" 2>&1
    echo "=== Cron Job Finished at $(date) ===" >> "$LOG_FILE"
    exit 1
fi

# ---- 実行情報 ----
echo "Python path: $("$ENV_PY" -c 'import sys; print(sys.executable)')" >> "$LOG_FILE"
echo "Python version: $("$ENV_PY" --version 2>&1)" >> "$LOG_FILE"
echo "Current directory: $(pwd)" >> "$LOG_FILE"

# ---- 実行 ----
"$ENV_PY" reserve.py --env .env.isshin --config config_isshin.json >> "$LOG_FILE" 2>&1

echo "=== Cron Job Finished at $(date) ===" >> "$LOG_FILE"
