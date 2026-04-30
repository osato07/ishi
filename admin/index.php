<?php
session_start();
define('BASE_DIR', dirname(__DIR__));

$cfg_file = __DIR__ . '/config.php';
$pw_hash  = '';
if (file_exists($cfg_file)) { @include $cfg_file; $pw_hash = defined('ADMIN_PW_HASH') ? ADMIN_PW_HASH : ''; }
$needs_setup = ($pw_hash === '');
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
$csrf = $_SESSION['csrf'];

if (isset($_GET['logout'])) { session_destroy(); header('Location: index.php'); exit; }

$err = '';
if ($needs_setup && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['setup_pw'])) {
    $p = $_POST['setup_pw'];
    if (strlen($p) >= 8) {
        $h = password_hash($p, PASSWORD_BCRYPT);
        file_put_contents($cfg_file, "<?php\ndefine('ADMIN_PW_HASH'," . var_export($h, true) . ");\n");
        session_regenerate_id(true); $_SESSION['auth'] = true;
        header('Location: index.php'); exit;
    }
    $err = 'パスワードは8文字以上にしてください';
}
if (!$needs_setup && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if (!hash_equals($csrf, $_POST['csrf'] ?? '')) { $err = '不正なリクエスト'; }
    elseif (password_verify($_POST['password'], $pw_hash)) {
        session_regenerate_id(true); $_SESSION['auth'] = true;
        header('Location: index.php'); exit;
    } else { $err = 'パスワードが違います'; }
}

$authed = !empty($_SESSION['auth']);

function load_users(): array {
    $out = [];
    foreach (glob(BASE_DIR . '/config_*.json') ?: [] as $f) {
        if (preg_match('/config_([a-zA-Z0-9_]+)\.json$/', $f, $m)) {
            $c = json_decode(file_get_contents($f), true) ?: [];
            $c['username'] = $m[1];
            $out[] = $c;
        }
    }
    return $out;
}
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
$users = $authed ? load_users() : [];
?><!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>予約管理ダッシュボード</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet">
<style>
body { background: #f0f2f5; }
.card { border: 0; box-shadow: 0 2px 8px rgba(0,0,0,.09); }
.log-box { background: #1e1e1e; color: #d4d4d4; font-family: monospace; font-size: .78rem;
           height: 360px; overflow-y: auto; white-space: pre-wrap; border-radius: 6px; padding: 12px; }
</style>
</head>
<body>
<?php if (!$authed): ?>
<div class="d-flex align-items-center justify-content-center" style="min-height:100vh">
  <div class="card p-4" style="width:360px">
    <h5 class="mb-4 text-center fw-bold">
      <i class="bi bi-calendar-check text-primary"></i> 予約管理
    </h5>
    <?php if ($err): ?><div class="alert alert-danger py-2 small"><?= h($err) ?></div><?php endif; ?>
    <?php if ($needs_setup): ?>
    <p class="text-muted small text-center">初回セットアップ: 管理パスワードを設定してください（8文字以上）</p>
    <form method="POST">
      <div class="mb-3">
        <input type="password" name="setup_pw" class="form-control" placeholder="新しいパスワード" required autofocus>
      </div>
      <button class="btn btn-primary w-100">設定して開始</button>
    </form>
    <?php else: ?>
    <form method="POST">
      <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
      <div class="mb-3">
        <input type="password" name="password" class="form-control" placeholder="パスワード" required autofocus>
      </div>
      <button class="btn btn-primary w-100"><i class="bi bi-box-arrow-in-right"></i> ログイン</button>
    </form>
    <?php endif; ?>
  </div>
</div>
<?php else: /* ===== DASHBOARD ===== */ ?>

<nav class="navbar navbar-dark bg-primary px-3 py-2">
  <span class="navbar-brand fw-bold fs-6">
    <i class="bi bi-calendar-check"></i> 予約管理ダッシュボード
  </span>
  <a href="?logout" class="btn btn-outline-light btn-sm"
     onclick="return confirm('ログアウトしますか?')">
    <i class="bi bi-box-arrow-right"></i> ログアウト
  </a>
</nav>

<div class="container-fluid py-4 px-4">

  <!-- ユーザー設定 -->
  <h6 class="text-muted fw-bold mb-3">ユーザー設定</h6>
  <div class="row g-3 mb-4">
  <?php foreach ($users as $u): $uname = h($u['username']); ?>
  <div class="col-12 col-md-6 col-xl-4">
    <div class="card">
      <div class="card-header bg-primary text-white fw-semibold py-2">
        <i class="bi bi-person-fill"></i> <?= $uname ?>
        <span class="badge <?= ($u['enabled'] ?? true) ? 'bg-success' : 'bg-secondary' ?> ms-2 float-end">
          <?= ($u['enabled'] ?? true) ? '有効' : '無効' ?>
        </span>
      </div>
      <div class="card-body" id="form-<?= $uname ?>">
        <div class="mb-2">
          <label class="form-label small fw-semibold mb-1">予約時刻（スペース区切り）</label>
          <input type="text" name="times" class="form-control form-control-sm"
            value="<?= h(implode(' ', $u['times'] ?? [])) ?>" placeholder="例: 16:50 17:50">
        </div>
        <div class="mb-2">
          <label class="form-label small fw-semibold mb-1">メニュー</label>
          <input type="text" name="menu" class="form-control form-control-sm"
            value="<?= h($u['menu'] ?? '技能教習') ?>">
        </div>
        <div class="mb-2">
          <label class="form-label small fw-semibold mb-1">
            日付指定 <span class="text-muted fw-normal">（空白 = 2日後を自動選択）</span>
          </label>
          <input type="text" name="date_override" class="form-control form-control-sm"
            value="<?= h($u['date_override'] ?? '') ?>" placeholder="例: 2026/05/10">
        </div>
        <div class="mb-3">
          <div class="form-check">
            <input type="checkbox" name="enabled" class="form-check-input" id="en-<?= $uname ?>"
              <?= ($u['enabled'] ?? true) ? 'checked' : '' ?>>
            <label class="form-check-label small" for="en-<?= $uname ?>">
              有効（cronで自動実行する）
            </label>
          </div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-primary btn-sm flex-fill" onclick="saveConfig('<?= $uname ?>')">
            <i class="bi bi-save"></i> 保存
          </button>
          <button class="btn btn-success btn-sm flex-fill" id="run-btn-<?= $uname ?>"
            onclick="runNow('<?= $uname ?>')">
            <i class="bi bi-play-fill"></i> 今すぐ実行
          </button>
          <button class="btn btn-secondary btn-sm" onclick="showLog('<?= $uname ?>')">
            <i class="bi bi-file-text"></i> ログ
          </button>
        </div>
      </div>
    </div>
  </div>
  <?php endforeach; ?>
  </div>

  <!-- ユーザー追加 -->
  <div class="card mb-4">
    <div class="card-header fw-semibold py-2">
      <i class="bi bi-person-plus"></i> ユーザー追加
    </div>
    <div class="card-body" id="add-user-form">
      <div class="row g-2">
        <div class="col-6 col-md-2">
          <label class="form-label small fw-semibold mb-1">ユーザー名</label>
          <input type="text" name="username" class="form-control form-control-sm" placeholder="例: taro">
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small fw-semibold mb-1">サイトのログインID</label>
          <input type="text" name="login_id" class="form-control form-control-sm">
        </div>
        <div class="col-6 col-md-2">
          <label class="form-label small fw-semibold mb-1">サイトのパスワード</label>
          <input type="text" name="login_pass" class="form-control form-control-sm">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small fw-semibold mb-1">時刻（スペース区切り）</label>
          <input type="text" name="times" class="form-control form-control-sm" placeholder="16:50 17:50">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small fw-semibold mb-1">メニュー</label>
          <input type="text" name="menu" class="form-control form-control-sm" value="技能教習">
        </div>
      </div>
      <div class="mt-3">
        <button class="btn btn-primary btn-sm" onclick="addUser()">
          <i class="bi bi-plus-circle"></i> ユーザーを追加
        </button>
        <small class="text-muted ms-2">.env・config JSON・run.sh が自動生成されます</small>
      </div>
    </div>
  </div>

  <!-- 管理者設定 -->
  <div class="card mb-4">
    <div class="card-header fw-semibold py-2">
      <i class="bi bi-shield-lock"></i> 管理者設定
    </div>
    <div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-auto">
          <label class="form-label small fw-semibold mb-1">新しい管理パスワード（8文字以上）</label>
          <input type="password" id="new-password" class="form-control form-control-sm" style="width:240px">
        </div>
        <div class="col-auto">
          <button class="btn btn-warning btn-sm" onclick="changePassword()">
            <i class="bi bi-key"></i> パスワード変更
          </button>
        </div>
      </div>
    </div>
  </div>

</div><!-- /container -->

<!-- Log Modal -->
<div class="modal fade" id="logModal" tabindex="-1">
  <div class="modal-dialog modal-lg modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header py-2">
        <h6 class="modal-title fw-bold" id="log-title">ログ</h6>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-2">
        <div class="log-box" id="log-content">読み込み中...</div>
      </div>
      <div class="modal-footer py-2">
        <button class="btn btn-sm btn-outline-secondary" onclick="refreshLog()">
          <i class="bi bi-arrow-clockwise"></i> 更新
        </button>
        <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">閉じる</button>
      </div>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="position-fixed bottom-0 end-0 p-3" style="z-index:9999">
  <div id="toast-msg" class="toast align-items-center border-0" role="alert">
    <div class="d-flex">
      <div class="toast-body fw-semibold"></div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
const CSRF = <?= json_encode($csrf) ?>;
let currentLogUser = null;

async function api(data) {
  const r = await fetch('api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, csrf: CSRF })
  });
  return r.json();
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast-msg');
  el.className = `toast align-items-center text-bg-${type} border-0`;
  el.querySelector('.toast-body').textContent = msg;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 3500 }).show();
}

async function saveConfig(u) {
  const f = document.getElementById('form-' + u);
  const times = f.querySelector('[name=times]').value.trim().split(/\s+/).filter(Boolean);
  const r = await api({
    action: 'save_config', username: u,
    config: {
      times,
      menu: f.querySelector('[name=menu]').value,
      date_override: f.querySelector('[name=date_override]').value,
      enabled: f.querySelector('[name=enabled]').checked
    }
  });
  toast(r.ok ? '✅ 保存しました' : '❌ ' + r.error, r.ok ? 'success' : 'danger');
}

async function runNow(u) {
  const btn = document.getElementById('run-btn-' + u);
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 実行中...';
  const r = await api({ action: 'run_now', username: u });
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-play-fill"></i> 今すぐ実行';
  toast(
    r.ok ? '✅ スクリプトを起動しました（数秒後にログを確認してください）' : '❌ ' + r.error,
    r.ok ? 'success' : 'danger'
  );
}

async function showLog(u) {
  currentLogUser = u;
  document.getElementById('log-title').textContent = u + ' のログ';
  document.getElementById('log-content').textContent = '読み込み中...';
  new bootstrap.Modal(document.getElementById('logModal')).show();
  const r = await api({ action: 'get_log', username: u });
  const el = document.getElementById('log-content');
  el.textContent = r.ok ? r.log : '❌ ' + r.error;
  el.scrollTop = el.scrollHeight;
}

async function refreshLog() {
  if (!currentLogUser) return;
  document.getElementById('log-content').textContent = '読み込み中...';
  const r = await api({ action: 'get_log', username: currentLogUser });
  const el = document.getElementById('log-content');
  el.textContent = r.ok ? r.log : '❌ ' + r.error;
  el.scrollTop = el.scrollHeight;
}

async function addUser() {
  const f = document.getElementById('add-user-form');
  const times = f.querySelector('[name=times]').value.trim().split(/\s+/).filter(Boolean);
  const r = await api({
    action: 'add_user',
    username: f.querySelector('[name=username]').value.trim(),
    login_id: f.querySelector('[name=login_id]').value,
    login_pass: f.querySelector('[name=login_pass]').value,
    times,
    menu: f.querySelector('[name=menu]').value
  });
  if (r.ok) {
    toast('✅ ' + (r.message || 'ユーザーを追加しました'), 'success');
    setTimeout(() => location.reload(), 1200);
  } else {
    toast('❌ ' + r.error, 'danger');
  }
}

async function changePassword() {
  const pw = document.getElementById('new-password').value;
  if (pw.length < 8) { toast('❌ 8文字以上にしてください', 'danger'); return; }
  const r = await api({ action: 'change_password', password: pw });
  toast(r.ok ? '✅ パスワードを変更しました' : '❌ ' + r.error, r.ok ? 'success' : 'danger');
  if (r.ok) document.getElementById('new-password').value = '';
}
</script>
<?php endif; ?>
</body>
</html>
