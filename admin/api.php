<?php
session_start();
define('BASE_DIR', dirname(__DIR__));
header('Content-Type: application/json; charset=utf-8');

function ok(array $d = []): never  { echo json_encode(['ok' => true] + $d); exit; }
function err(string $m): never     { echo json_encode(['ok' => false, 'error' => $m]); exit; }

if (empty($_SESSION['auth'])) err('未ログイン');

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) err('不正なリクエスト');
if (!hash_equals($_SESSION['csrf'] ?? '', $body['csrf'] ?? '')) err('CSRFエラー');

$action = $body['action'] ?? '';

function valid_user(string $u): bool {
    return (bool) preg_match('/^[a-zA-Z0-9_]{1,32}$/', $u);
}

switch ($action) {

    case 'save_config': {
        $u = $body['username'] ?? '';
        if (!valid_user($u)) err('ユーザー名が不正です');
        if (!file_exists(BASE_DIR . "/config_$u.json")) err("ユーザー $u が見つかりません");
        $cfg = $body['config'] ?? [];
        $times = array_values(array_filter(
            array_map('strval', $cfg['times'] ?? []),
            fn($t) => (bool) preg_match('/^\d{1,2}:\d{2}$/', $t)
        ));
        if (!$times) err('時刻を1つ以上指定してください（例: 16:50）');
        $do = $cfg['date_override'] ?? '';
        $existing = json_decode(file_get_contents(BASE_DIR . "/config_$u.json"), true) ?: [];
        $save = array_merge($existing, [
            'times'         => $times,
            'menu'          => mb_substr(strval($cfg['menu'] ?? '技能教習'), 0, 50),
            'date_override' => preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $do) ? $do : '',
            'enabled'       => (bool) ($cfg['enabled'] ?? true),
        ]);
        file_put_contents(
            BASE_DIR . "/config_$u.json",
            json_encode($save, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
        ok();
    }

    case 'run_now': {
        $u = $body['username'] ?? '';
        if (!valid_user($u)) err('ユーザー名が不正です');
        $cfg_path = BASE_DIR . "/config_$u.json";
        if (!file_exists($cfg_path)) err("config_$u.json が見つかりません");
        $cfg = json_decode(file_get_contents($cfg_path), true);
        $script = basename($cfg['run_script'] ?? "run_$u.sh");
        $script_path = BASE_DIR . '/' . $script;
        if (!file_exists($script_path)) err("$script が見つかりません");
        if (!is_executable($script_path)) err("$script に実行権限がありません（chmod +x してください）");
        shell_exec('/bin/bash ' . escapeshellarg($script_path) . ' > /dev/null 2>&1 &');
        ok(['message' => "$script を起動しました"]);
    }

    case 'get_log': {
        $u = $body['username'] ?? '';
        if (!valid_user($u)) err('ユーザー名が不正です');
        $cfg_path = BASE_DIR . "/config_$u.json";
        if (!file_exists($cfg_path)) err("設定ファイルが見つかりません");
        $cfg = json_decode(file_get_contents($cfg_path), true);
        $log_file = basename($cfg['log_file'] ?? "reserve_$u.log");
        $log_path = BASE_DIR . '/' . $log_file;
        if (!file_exists($log_path)) ok(['log' => '（ログファイルがまだありません）']);
        $lines = file($log_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        ok(['log' => implode("\n", array_slice($lines, -150))]);
    }

    case 'add_user': {
        $u = $body['username'] ?? '';
        if (!valid_user($u)) err('ユーザー名は半角英数字・アンダースコア（32文字以内）');
        if (file_exists(BASE_DIR . "/config_$u.json")) err("ユーザー $u は既に存在します");
        $lid  = trim(strval($body['login_id']   ?? ''));
        $lpw  = strval($body['login_pass'] ?? '');
        $times = array_values(array_filter(
            array_map('strval', $body['times'] ?? []),
            fn($t) => (bool) preg_match('/^\d{1,2}:\d{2}$/', $t)
        ));
        $menu = mb_substr(strval($body['menu'] ?? '技能教習'), 0, 50);
        if (!$lid || !$lpw) err('ログインIDとパスワードは必須です');
        if (!$times) err('時刻を1つ以上指定してください（例: 16:50）');

        // .env.username
        file_put_contents(
            BASE_DIR . "/.env.$u",
            "# $u アカウント\nLOGIN_ID=$lid\nLOGIN_PASS=$lpw\n"
        );
        chmod(BASE_DIR . "/.env.$u", 0600);

        // config_username.json
        $config = [
            'times'         => $times,
            'menu'          => $menu,
            'date_override' => '',
            'enabled'       => true,
            'run_script'    => "run_$u.sh",
            'log_file'      => "reserve_$u.log",
        ];
        file_put_contents(
            BASE_DIR . "/config_$u.json",
            json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        // run_username.sh - run.sh をテンプレートとして生成
        $tpl = file_get_contents(BASE_DIR . '/run.sh');
        $sh  = preg_replace('/^LOG_FILE=.*$/m',
            "LOG_FILE=\"\$PROJECT_DIR/reserve_$u.log\"", $tpl, 1);
        $sh  = preg_replace('/^"\\$ENV_PY" reserve\.py.*$/m',
            '"$ENV_PY" reserve.py --env .env.' . $u . ' --config config_' . $u . '.json >> "$LOG_FILE" 2>&1',
            $sh, 1);
        $sh  = preg_replace('/^# .*$/m',
            "# $u アカウント用 reserve.py 実行スクリプト", $sh, 1);
        // ログ終了行がなければ追加
        if (strpos($sh, 'Cron Job Finished') === false) {
            $sh .= "\necho \"=== Cron Job Finished at \$(date) ===\" >> \"\$LOG_FILE\"\n";
        }
        $script_path = BASE_DIR . "/run_$u.sh";
        file_put_contents($script_path, $sh);
        chmod($script_path, 0755);

        ok(['message' => "ユーザー $u を追加しました。cronの設定を忘れずに！"]);
    }

    case 'change_password': {
        $pw = $body['password'] ?? '';
        if (strlen($pw) < 8) err('パスワードは8文字以上にしてください');
        $cfg_file = __DIR__ . '/config.php';
        $h = password_hash($pw, PASSWORD_BCRYPT);
        file_put_contents($cfg_file, "<?php\ndefine('ADMIN_PW_HASH'," . var_export($h, true) . ");\n");
        ok();
    }

    default:
        err('不明なアクション');
}
