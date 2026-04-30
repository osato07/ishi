#!/usr/bin/env python3
"""
ishii-ds.resv.jp 予約自動化スクリプト (requests 版)

Playwright を使わず requests + BeautifulSoup だけで動作する。
Xserver 等 Chromium が動かない共有ホスティングでも cron で動く。

使用方法:
    python3 reserve.py --time "9:00" "10:00" --menu "技能教習"

オプション:
    --date      日付 (例: "2026/04/25"。省略時は今日から2日後)
    --time      時刻 (複数指定可、例: "9:00" "10:00")
    --menu      メニュー名 (部分一致、例: "技能教習")
    --dry-run   最終確定POSTを送らずに終了する

終了コード:
    0  指定した時刻のうち、1つ以上予約に成功した（または dry-run 成功）
    1  致命的なエラー（ログイン失敗など）
    2  対象の予約枠がいずれも見つからなかった、またはすべて満席だった
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timedelta
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# ─────────────────────────────────────────────
# 定数
# ─────────────────────────────────────────────
BASE_URL = "https://ishii-ds.resv.jp/"
CALENDAR_URL = urljoin(BASE_URL, "reserve/calendar.php")
TIMETABLE_AJAX_URL = urljoin(BASE_URL, "reserve/get_timetable_pc.php")
LOGIN_URL = urljoin(BASE_URL, "user/res_user.php")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
DUMP_DIR = Path(__file__).parent / "dumps"
TIMEOUT = 30  # seconds

# ─────────────────────────────────────────────
# ログ設定
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# 引数 / 認証
# ─────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="ishii-ds 予約自動化スクリプト (requests 版)")
    p.add_argument("--date", help='日付 (省略時は2日後)。例: "2026/04/25"')
    p.add_argument("--time", nargs="+", help='時刻 (複数可)。--config 指定時は省略可。例: "9:00" "10:00"')
    p.add_argument("--menu", help='メニュー名 (部分一致)。--config 指定時は省略可。例: "技能教習"')
    p.add_argument("--env", default=".env", help='.env ファイルのパス (省略時は .env)。例: ".env.isshin"')
    p.add_argument("--config", default=None, help='設定JSONファイルのパス。例: "config_osatoosi.json"')
    p.add_argument("--dry-run", action="store_true", help="最終確定POSTを送らない")
    return p.parse_args()


def load_credentials(env_file: str = ".env") -> tuple[str, str]:
    env_path = Path(__file__).parent / env_file
    load_dotenv(dotenv_path=env_path, override=True)
    login_id = os.getenv("LOGIN_ID")
    login_pw = os.getenv("LOGIN_PASS")
    if not login_id or not login_pw:
        logger.error(f"{env_path} に LOGIN_ID / LOGIN_PASS が設定されていません")
        sys.exit(1)
    return login_id, login_pw


# ─────────────────────────────────────────────
# ユーティリティ
# ─────────────────────────────────────────────
def dump_html(label: str, html: str) -> None:
    DUMP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = DUMP_DIR / f"{ts}_{label}.html"
    try:
        path.write_text(html, encoding="utf-8")
        logger.info(f"HTML ダンプ保存: {path}")
    except Exception as e:
        logger.warning(f"HTML ダンプ保存失敗: {e}")


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": USER_AGENT,
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    })
    return s


def get_form_hidden_fields(form) -> dict[str, str]:
    """<form> 要素から hidden input を辞書化"""
    fields: dict[str, str] = {}
    for inp in form.find_all("input"):
        name = inp.get("name")
        if not name:
            continue
        itype = (inp.get("type") or "text").lower()
        if itype == "hidden":
            fields[name] = inp.get("value", "")
    return fields


# ─────────────────────────────────────────────
# ログイン
# ─────────────────────────────────────────────
def is_login_page(html: str) -> bool:
    return ('name="loginid"' in html) and ('name="loginpw"' in html)


def do_login(session: requests.Session, login_id: str, login_pw: str) -> None:
    logger.info("ログイン処理を実行")
    # ログインページを GET (フォーム取得 / Cookie 受領)
    r = session.get(LOGIN_URL, timeout=TIMEOUT)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # ログインフォーム特定
    form = None
    for f in soup.find_all("form"):
        if f.find("input", attrs={"name": "loginid"}) and f.find("input", attrs={"name": "loginpw"}):
            form = f
            break
    if form is None:
        dump_html("login_page_no_form", r.text)
        raise RuntimeError("ログインフォームが見つかりません")

    action = urljoin(r.url, form.get("action") or "")
    payload = get_form_hidden_fields(form)
    payload["loginid"] = login_id
    payload["loginpw"] = login_pw
    # submit ボタンの name/value も渡す
    submit = form.find("input", attrs={"type": "submit"}) or form.find("button", attrs={"type": "submit"})
    if submit and submit.get("name"):
        payload[submit["name"]] = submit.get("value", "")

    method = (form.get("method") or "post").lower()
    if method == "post":
        r2 = session.post(action, data=payload, timeout=TIMEOUT, allow_redirects=True)
    else:
        r2 = session.get(action, params=payload, timeout=TIMEOUT, allow_redirects=True)
    r2.raise_for_status()

    if is_login_page(r2.text):
        dump_html("login_failed", r2.text)
        raise RuntimeError("ログインに失敗しました（loginid/loginpw 不正の可能性）")
    logger.info("ログイン成功")


# ─────────────────────────────────────────────
# カレンダー解析
# ─────────────────────────────────────────────
RES_DETAIL_RE = re.compile(r"location\.href\s*=\s*['\"]([^'\"]*res_timetbl_detail\.php[^'\"]*)['\"]", re.I)


JS_VAR_RE = {
    "cur_year": re.compile(r'cur_year\s*=\s*"(\d+)"'),
    "cur_month": re.compile(r'cur_month\s*=\s*"(\d+)"'),
    "cur_day": re.compile(r'cur_day\s*=\s*"(\d+)"'),
    "relation_mp": re.compile(r'relation_mp\s*=\s*"([^"]*)"'),
    "cur_reserve_mode": re.compile(r'cur_reserve_mode\s*=\s*"([^"]*)"'),
    "cur_reserve_mode_user": re.compile(r'cur_reserve_mode_user\s*=\s*"([^"]*)"'),
    "cur_cancel_guest_hash": re.compile(r'cur_cancel_guest_hash\s*=\s*"([^"]*)"'),
}


def fetch_calendar(session: requests.Session, target_date: str) -> str:
    """カレンダーページ + AJAX 一覧 HTML を取得して結合した文字列を返す。
    target_date は 'YYYY/MM/DD' 形式。"""
    r = session.get(CALENDAR_URL, timeout=TIMEOUT)
    r.raise_for_status()
    if is_login_page(r.text):
        raise RuntimeError("カレンダー取得時に再ログインが必要 (セッション切れ)")

    # JS 変数から既定値を抽出
    js_vars: dict[str, str] = {}
    for k, rx in JS_VAR_RE.items():
        m = rx.search(r.text)
        js_vars[k] = m.group(1) if m else ""

    # 指定日でクエリするために cur_year/month/day を上書き
    try:
        dt = datetime.strptime(target_date, "%Y/%m/%d")
        js_vars["cur_year"] = str(dt.year)
        js_vars["cur_month"] = str(dt.month)
        js_vars["cur_day"] = str(dt.day)
    except ValueError:
        logger.warning(f"target_date 解析失敗、JS 既定値を使用: {target_date}")

    params = {
        "view_mode": "day",
        "view_list": "1",
        "relation_mp": js_vars.get("relation_mp", "1"),
        "cur_year": js_vars["cur_year"],
        "cur_month": js_vars["cur_month"],
        "cur_day": js_vars["cur_day"],
        "cur_categ_id": "0",
        "cur_mp_id": "0",
        "pager_current": "1",
        "reserve_mode": js_vars.get("cur_reserve_mode", ""),
        "reserve_mode_user": js_vars.get("cur_reserve_mode_user", ""),
        "cancel_guest_hash": js_vars.get("cur_cancel_guest_hash", ""),
    }
    rt = session.get(
        TIMETABLE_AJAX_URL,
        params=params,
        timeout=TIMEOUT,
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Referer": CALENDAR_URL,
            "Accept": "text/html, */*; q=0.01",
        },
    )
    rt.raise_for_status()
    return rt.text


def find_reservation_url(
    calendar_html: str,
    target_date: str,
    target_time: str,
    target_menu: str,
) -> str | None:
    """カレンダー HTML から条件にマッチする行の予約詳細 URL を返す。なければ None。"""
    soup = BeautifulSoup(calendar_html, "html.parser")
    table = soup.find("table", class_="calendar-type-4")
    if table is None:
        return None

    for tr in table.find_all("tr"):
        if "list_th" in (tr.get("class") or []):
            continue
        tds = tr.find_all("td")
        if len(tds) < 6:
            continue

        col_date = tds[1].get_text(strip=True)
        col_time = tds[2].get_text(strip=True)
        col_menu = tds[4].get_text(strip=True)

        if not col_date.startswith(target_date):
            continue
        if not col_time.startswith(target_time):
            continue
        if target_menu not in col_menu:
            continue

        # 「予約する」ボタンを探す
        a = tr.find("a", class_="main-btn")
        if a is None:
            return None
        # href が直接 URL の場合と、onclick で location.href= の場合がある
        href = a.get("href") or ""
        if href and "res_timetbl_detail.php" in href:
            return urljoin(CALENDAR_URL, unescape(href))
        onclick = a.get("onclick") or ""
        m = RES_DETAIL_RE.search(unescape(onclick))
        if m:
            return urljoin(CALENDAR_URL, m.group(1))
        return None

    return None


# ─────────────────────────────────────────────
# 詳細 → 確認 → 完了
# ─────────────────────────────────────────────
def fetch_detail(session: requests.Session, detail_url: str) -> tuple[str, str]:
    """詳細ページを取得。(html, final_url) を返す"""
    r = session.get(detail_url, timeout=TIMEOUT, headers={"Referer": CALENDAR_URL})
    r.raise_for_status()
    return r.text, r.url


def submit_detail(session: requests.Session, detail_html: str, detail_url: str) -> tuple[str, str] | str:
    """詳細ページのフォームを POST して確認ページの (html, url) を返す。
    予約 submit ボタンが無い場合は理由文字列を返す:
        'full'         - 「定員になりました」等で満席
        'over_limit'   - 規定回数オーバー
        'no_form'      - reserveform 自体が無い
        'no_submit'    - フォームはあるが submit が無い (理由不明)
    """
    soup = BeautifulSoup(detail_html, "html.parser")
    form = soup.find("form", attrs={"name": "reserveform"})
    if form is None:
        return "no_form"

    submit = None
    for cand in form.find_all(["input", "button"]):
        itype = (cand.get("type") or "").lower()
        if itype == "submit":
            submit = cand
            break
    if submit is None:
        text = soup.get_text(" ", strip=True)
        if "定員になりました" in text or "満員" in text:
            return "full"
        if "規定回数" in text or "上限" in text or "予約済み" in text:
            return "over_limit"
        return "no_submit"

    action = urljoin(detail_url, form.get("action") or "")
    payload = get_form_hidden_fields(form)
    if submit.get("name"):
        payload[submit["name"]] = submit.get("value", "")

    r = session.post(
        action,
        data=payload,
        timeout=TIMEOUT,
        allow_redirects=True,
        headers={"Referer": detail_url},
    )
    r.raise_for_status()
    return r.text, r.url


def submit_confirm(
    session: requests.Session,
    confirm_html: str,
    confirm_url: str,
    dry_run: bool,
) -> tuple[bool, str | None, str | None]:
    """確認ページの「完了する」を送信して (成功フラグ, last_html, last_url) を返す。"""
    soup = BeautifulSoup(confirm_html, "html.parser")
    submit = soup.find(id="res_confrim_submit")
    if submit is None:
        # 念のため別パターンも探す
        submit = soup.find("input", attrs={"name": "submit1"})
    if submit is None:
        return False, None, None

    form = submit.find_parent("form")
    if form is None:
        return False, None, None

    action = urljoin(confirm_url, form.get("action") or "")
    payload = get_form_hidden_fields(form)
    if submit.get("name"):
        payload[submit["name"]] = submit.get("value", "完了する")

    if dry_run:
        logger.info(f"[DRY-RUN] 確定 POST をスキップ: {action} payload_keys={list(payload.keys())}")
        return True, None, None

    r = session.post(
        action,
        data=payload,
        timeout=TIMEOUT,
        allow_redirects=True,
        headers={"Referer": confirm_url},
    )
    r.raise_for_status()
    return True, r.text, r.url


def is_reservation_completed(html: str, url: str) -> bool:
    if "res_last.php" in url:
        return True
    keywords = ["予約が完了", "受付しました", "予約完了", "完了しました"]
    return any(k in html for k in keywords)


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────
def main() -> None:
    args = parse_args()
    login_id, login_pw = load_credentials(args.env)

    # --config からの設定読み込み（CLI引数が優先）
    cfg: dict = {}
    if args.config:
        config_path = Path(__file__).parent / args.config
        if config_path.exists():
            with open(config_path, encoding="utf-8") as f:
                cfg = json.load(f)
        else:
            logger.warning(f"設定ファイルが見つかりません: {config_path}")

    if not cfg.get("enabled", True):
        logger.info("設定で無効化されています（enabled=false）。スキップします。")
        sys.exit(0)

    times: list[str] = args.time or cfg.get("times", [])
    menu: str = args.menu or cfg.get("menu", "")
    target_date: str = args.date or cfg.get("date_override") or \
        (datetime.now() + timedelta(days=2)).strftime("%Y/%m/%d")

    if not times or not menu:
        logger.error("--time と --menu が必要です（または --config で設定してください）")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info(f"予約開始: date={target_date}, times={times}, menu={menu}")
    if args.dry_run:
        logger.info("【DRY-RUN モード】最終予約確定は行いません")

    session = make_session()
    success_count = 0

    try:
        do_login(session, login_id, login_pw)
    except Exception as e:
        logger.error(f"ログイン失敗: {e}", exc_info=True)
        sys.exit(1)

    for target_time in times:
        logger.info("-" * 40)
        logger.info(f"【判定開始】 時刻: {target_time}")

        try:
            calendar_html = fetch_calendar(session, target_date)
        except Exception as e:
            logger.error(f"カレンダー取得失敗: {e}", exc_info=True)
            continue

        detail_url = find_reservation_url(calendar_html, target_date, target_time, menu)
        if detail_url is None:
            logger.warning(f"[{target_time}] 該当の予約行が見つからない、または予約ボタン無し")
            continue

        logger.info(f"[{target_time}] 詳細URLを発見: {detail_url}")
        try:
            detail_html, detail_final_url = fetch_detail(session, detail_url)
        except Exception as e:
            logger.error(f"[{target_time}] 詳細ページ取得失敗: {e}", exc_info=True)
            continue

        confirm_result = submit_detail(session, detail_html, detail_final_url)
        if isinstance(confirm_result, str):
            reason = confirm_result
            if reason == "full":
                logger.info(f"[{target_time}] 満席（定員になりました）→ スキップ")
            elif reason == "over_limit":
                logger.info(f"[{target_time}] 規定回数/上限により予約不可 → スキップ")
            elif reason == "no_form":
                logger.error(f"[{target_time}] 詳細ページに reserveform が見つかりません（サイト構造変更の可能性）")
                dump_html(f"detail_no_form_{target_time.replace(':','')}", detail_html)
            else:  # no_submit
                logger.error(f"[{target_time}] 詳細ページに予約ボタンなし（理由不明・要HTML確認）")
                dump_html(f"detail_no_submit_{target_time.replace(':','')}", detail_html)
            continue
        confirm_html, confirm_url = confirm_result

        # 確認ページに遷移できたか確認
        if "res_confrim_submit" not in confirm_html and "完了する" not in confirm_html:
            logger.error(f"[{target_time}] 確認ページに進めませんでした")
            dump_html(f"confirm_unexpected_{target_time.replace(':','')}", confirm_html)
            continue

        logger.info(f"[{target_time}] 確認ページ到達。完了処理を実行")
        ok, last_html, last_url = submit_confirm(session, confirm_html, confirm_url, args.dry_run)
        if not ok:
            logger.error(f"[{target_time}] 確認ページの完了ボタンが見つかりません")
            dump_html(f"confirm_no_button_{target_time.replace(':','')}", confirm_html)
            continue

        if args.dry_run:
            logger.info(f"[DRY-RUN] [{target_time}] 成功扱い")
            success_count += 1
            continue

        if last_html is not None and is_reservation_completed(last_html, last_url or ""):
            logger.info(f"✅ [{target_time}] の予約が完了しました！")
            success_count += 1
        else:
            logger.error(f"[{target_time}] 予約完了を確認できませんでした (url={last_url})")
            if last_html:
                dump_html(f"last_unknown_{target_time.replace(':','')}", last_html)

    logger.info("=" * 60)
    if success_count > 0:
        logger.info(f"処理完了: {success_count}件 の予約に成功しました。")
        sys.exit(0)
    logger.info("処理完了: 有効な予約枠は空いていませんでした。")
    sys.exit(2)


if __name__ == "__main__":
    main()
