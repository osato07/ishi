# 🏫 ishii-ds 予約自動化システム

教習所（ishii-ds.resv.jp）の予約を自動で取るシステムです。  
指定した時刻に合わせて cron で定期実行することで、空き枠が出た瞬間に予約できます。

---

## ⚠️ 重要な注意点

**現在の設定は固定です。**  
`config_xxx.json` で時刻を指定していますが、外部から変更しない限り **毎日同じ時刻を狙い続けます。**  
すでに誰かに取られた枠でも翌日また同じ枠を狙うため、  
**「今日はこの時間は要らない」「別の時間にしたい」場合は、毎回手動で設定を変える必要があります。**

→ ダッシュボード（`/ishi/admin/`）を使えばブラウザから変更できます。

---

## 📁 ファイル構成（主要ファイル）

```
ishi/
├── reserve.py              # 予約スクリプト本体
├── run.sh                  # cron から呼ばれる実行スクリプト（osatoosi用）
├── run_isshin.sh           # isshin ユーザー用
├── config_osatoosi.json    # osatoosi の予約設定（時刻・メニュー等）
├── config_isshin.json      # isshin の予約設定
├── .env                    # osatoosi のログイン情報（Git管理外）
├── .env.isshin             # isshin のログイン情報（Git管理外）
├── .env.example            # .env のテンプレート
├── .htaccess               # .env等への直接アクセスを遮断
└── admin/
    ├── index.php           # 管理ダッシュボード
    └── api.php             # ダッシュボードのAPI
```

---

## 🚀 新規ユーザーの追加方法

### 方法①：ダッシュボードから追加（推奨）

`https://sato4.jp/ishi/admin/` にアクセスし、  
「ユーザー追加」フォームに入力するだけで `.env`・`config JSON`・`run.sh` が自動生成されます。

### 方法②：手動で追加

**① `.env.username` を作成**

```bash
# .env.example をコピーして編集
cp .env.example .env.taro
```

```
LOGIN_ID=サイトのログインID
LOGIN_PASS=サイトのパスワード
```

```bash
chmod 600 .env.taro  # 権限を制限（重要）
```

**② `config_taro.json` を作成**

```json
{
    "times": ["16:50", "17:50"],
    "menu": "技能教習",
    "date_override": "",
    "enabled": true,
    "run_script": "run_taro.sh",
    "log_file": "reserve_taro.log"
}
```

| フィールド | 説明 |
|---|---|
| `times` | 予約したい時刻（複数可） |
| `menu` | 予約メニュー（部分一致） |
| `date_override` | 特定日を指定 `"2026/05/10"` 空白=2日後 |
| `enabled` | `false` にするとcron実行時にスキップ |

**③ `run_taro.sh` を作成**

```bash
cp run.sh run_taro.sh
# 以下の2行を変更
# LOG_FILE="$PROJECT_DIR/reserve_taro.log"
# "$ENV_PY" reserve.py --env .env.taro --config config_taro.json >> "$LOG_FILE" 2>&1
chmod +x run_taro.sh
```

---

## 🖥️ サーバー設定

### Xserver（現在使用中・推奨）

共有ホスティングで動作確認済みです。

**初回セットアップ（SSH接続後）：**

```bash
cd ~/sato4.jp/public_html/ishi

# Git から取得
git pull origin main

# .env を作成（Git管理外のため手動で作成が必要）
cp .env.example .env
nano .env  # LOGIN_ID と LOGIN_PASS を入力
chmod 600 .env

# config JSON を作成
nano config_osatoosi.json  # 上記のJSON形式で記入

# Python 環境構築（初回のみ、run.sh が自動で行う）
chmod +x run.sh run_isshin.sh
bash run.sh  # テスト実行
```

**cron の設定（Xserver コントロールパネル or crontab -e）：**

```cron
# osatoosi（毎日12:00に実行）
0 12 * * * /bin/bash /home/osatoosi3104/sato4.jp/public_html/ishi/run.sh

# isshin（毎日12:05に実行 ← 5分ずらして競合回避）
5 12 * * * /bin/bash /home/osatoosi3104/sato4.jp/public_html/ishi/run_isshin.sh
```

> **ポイント：** ユーザーを複数追加した場合は必ず5〜10分ずつずらしてください。  
> 同じ時刻に実行すると、先に取った人が枠を占有してしまいます。

---

### Vercel / Firebase（非推奨）

これらはフロントエンド・APIホスティング向けサービスです。  
このシステムは **シェルスクリプト + Python + cron** で動作するため、**Vercel や Firebase では動きません。**

| サービス | 向いている用途 | このシステムとの相性 |
|---|---|---|
| Xserver | PHP・Python・cron | ✅ 動作確認済み |
| VPS（ConoHa等） | 何でも可 | ✅ 動く（初期設定が必要） |
| Vercel | Next.js等のWebアプリ | ❌ cron・シェルが使えない |
| Firebase | モバイルアプリ等 | ❌ 向いていない |

VPS を使う場合は `crontab -e` でそのまま設定できます。

---

## 🔐 セキュリティ

- `.env` ファイルは `.htaccess` でWeb経由のアクセスをブロック済み
- `.env` は Git にコミットされません（`.gitignore` で除外）
- ダッシュボードはパスワード保護（bcrypt ハッシュ）
- CSRF トークンで二重送信・不正アクセス対策済み

---

## 🙏 設定・導入を頼みたい場合

**全部やります。**  
サーバー設定・cron設定・ユーザー追加・ダッシュボード設置、まとめてお任せください。

> **制作者：中本**  
> 代わりに何か奢ってくれたらね 😎
