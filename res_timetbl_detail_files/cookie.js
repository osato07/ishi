//================================================================================
// Cookie
//================================================================================
Cookie.prototype.set = Cookie_set;
Cookie.prototype.get = Cookie_get;
Cookie.prototype.rm  = Cookie_rm;
// constructer
function Cookie () {}
// set
function Cookie_set(key, val) {/*{{{*/

	// cookieの有効期限
	var expr = new Date();
	expr.setHours(expr.getHours() + 3600 * 24 * 30);
	// ユーザエージェントがiOS12 およびMacOS 10.14 の場合は対応しない
	var agent = window.navigator.userAgent.toLowerCase();
	var addSamesite = "";
	if (
		agent.indexOf('iphone os 12') == -1
		&& agent.indexOf('ipad; cpu os 12') == -1
		&& agent.indexOf('mac os x 10_14') == -1
	) {
		addSamesite = "; SameSite=None;Secure";
	}

	expr = ";expires=" + expr.toGMTString() + addSamesite;

	// 有効期限付きでcookieをセット
	expr = (3600 > 0) ? expr : "";
	document.cookie = escape(key) + "=" + escape(val) + expr;

}/*}}}*/
// get
function Cookie_get(key) {/*{{{*/

	// 返値
	var val = "";

	var cookie = unescape(document.cookie + ";");
	var part = cookie.split(";");
	for (var idx in part) {
		// キー名ミスマッチ
		if (part[idx].indexOf(key) < 0) { continue; }
		if (part[idx].indexOf("=") < 0) { continue; }
		// 値抽出
		var ary = part[idx].split("=");
		val = ary[1];
		break;
	}
	return val;
}/*}}}*/
// delete
function Cookie_rm (key) {/*{{{*/
	// cookieの期間を過去に
	var expr = new Date();
	expr.setHours(expr.getHours() - 24);
	expr = expr.toGMTString();
	// cookieをセット
	document.cookie = escape(key) + "=" + ";expires=" + expr;
}/*}}}*/

var chk_cookie = new Cookie();
chk_cookie.set('cookie_enable', '1');

var chk_cookie_flg = chk_cookie.get('cookie_enable');

if (!chk_cookie_flg) {
	$(document).ready(function() {
		$('#checkcookie').css('display', '');
		$('#right-column ').css('display', 'none');
		$('.control_display').css('display', 'none');
	});
}
