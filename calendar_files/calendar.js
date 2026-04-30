
var changeViewModeDay = {};
var DEF_VIEW_MODE = {1:"day", 2:"week", 3:"month"};
var timer_resize = false;
var timer_baloon = false;
var width = $("#main").outerWidth();

$(function() {

	$(window).on('resize', function(e) {
		if ((width - 40 < $("#main").outerWidth()) && (width + 40 > $("#main").outerWidth())) {
			return;
		}

		width = $("#main").outerWidth();

		if (timer_resize !== false) {
			clearTimeout(timer_resize);
		}

		timer_resize = setTimeout(function() {
			// SPからPCへ切り替えたとき、アクティブ装飾を適切なボタンへ適用
			var select_mode = $('#screensize_sp option:selected').val();
			$('#screensize_pc li').removeClass('select');
			$('#screensize_pc li').eq(select_mode - 1 ).addClass('select');
			get_timetable({}, function(){});
		}, 200);

	});

	changeViewModeDay = change_view_mode_day;

	// PC? or SP? フラグを設定 true であれば PCモード
	var $flg_screensize_pc = $("#screensize_pc").is(':visible') ? true : false;

	var $view_mode = $("#view_mode li");
	var $view_list = $("#view_list li");
	var $timetable = $("#timetable");
	var $loading_timetable = $("#loading_timetable");
	var $categ_select = $("#categ_select");
	var $mplan_select = $("#mplan_select");
	var $staff_select = $("#staff_select");

	// 日/週/月 表示
	view_mode_handler($("#view_mode li.select"));

	get_timetable({}, function(){});

	// ハンドラ一覧
	// 表示切替クリックハンドラ
	// PCの処理
	$view_mode.click(function() {
		// 表示を切り替える。
		view_mode_handler($(this));
		get_timetable({}, function(){});
	});

	// SPの処理
	$('#screensize_sp').change(function(){
		// 表示を切り替える。
		view_mode_handler($('#screensize_sp option:selected'));
		get_timetable({}, function(){});
	})

	// リスト表示切替クリックハンドラ
	$view_list.click(function() {

		// 表示を切り替える。
		view_list_handler();

		get_timetable({}, function(){});
	});

	// pagerのタグを表示
	//$("li.pager_tag a", $timetable).live("click", function() {
	$($timetable).on("click", "li.pager_tag a", function() {
		var url = $(this).attr("href");
		$(this).attr("href", "javascript:void(0);");
		if (url) {
			get_timetable({url: url}, function(){});
		}
		$(this).blur();
		$("html, body").scrollTop($("#calendar").offset().top);
		return false;
	});

	// 表示条件の「条件がクリアされました」メッセージをフェードアウトする
	setTimeout(function() {
		$('#cur_msg').fadeOut();
	}, 5000);

	// バルーンの非表示
	$(document).on("click", "#baloon_close", function() {
		hide_baloon();
	});

	// 日付（カレンダー）変更ハンドラ
	// 今日/今週/今月ボタンクリックハンドラ
	$(".target_date").click(function() {


		// SameSite対策 ユーザエージェントがiOS12 およびMacOS 10.14 の場合は対応しない
		var agent = window.navigator.userAgent.toLowerCase();
		var addSamesite = "";
		if (
			agent.indexOf('iphone os 12') == -1
			&& agent.indexOf('ipad; cpu os 12') == -1
			&& agent.indexOf('mac os x 10_14') == -1
		) {
			addSamesite = "; SameSite=None;Secure";
		}

		// 表示を切り替える。今日をセットする
		var date = new Date();
		cur_year = date.getFullYear();
		cur_month = date.getMonth() + 1;	// 0:1月, 1:2月 ...
		cur_day = date.getDate();

		get_timetable({}, function(){});
	});

	// ＞ 次へ（翌日、翌週、翌月）ボタンクリックハンドラ
	$("#next").click(function() {

		//PC? or SP? フラグを再取得
		$flg_screensize_pc = $("#screensize_pc").is(':visible') ? true : false;

		// SameSite対策 ユーザエージェントがiOS12 およびMacOS 10.14 の場合は対応しない
		var agent = window.navigator.userAgent.toLowerCase();
		var addSamesite = "";
		if (
			agent.indexOf('iphone os 12') == -1
			&& agent.indexOf('ipad; cpu os 12') == -1
			&& agent.indexOf('mac os x 10_14') == -1
		) {
			addSamesite = "; SameSite=None;Secure";
		}

		// 変更前をとっておく
		var org_m = parseInt(cur_month, 10);

		// 日付をずらす
		if($flg_screensize_pc){
			//pcの処理
			var view_mode = $("#view_mode li.select").val();
		} else {
			//SPの処理
			var view_mode = $('#screensize_sp option:selected').val();
		}
		if (view_mode == 1) {
			cur_day = (cur_day * 1) + 1;
		} else if (view_mode == 2) {
			cur_day = (cur_day * 1) + 7;
		} else if (view_mode == 3) {
			cur_month = (cur_month * 1) + 1;
		}

		// Date型にする
		var date = new Date(cur_year, cur_month - 1, cur_day);	// 月は 0:1月, 1:2月 ... 11:12月

		if (view_mode == 3) {
			// 月が飛んでいないか確認する
			var m = parseInt(date.getMonth() + 1, 10);
			if ((org_m == 12 && m == 1) ||
				((org_m + 1) == m)) {
				// この状態ならOK
			} else {
				// 5/31 で1ヵ月動かして 7/1 になってしまうような場合（6/31 がないから）
				cur_day = 1;	// 日付を1日にする
				date = new Date(cur_year, cur_month - 1, cur_day);	// 月は 0:1月, 1:2月 ... 11:12月
			}
		}

		cur_year = date.getFullYear();
		cur_month = date.getMonth() + 1;
		cur_day = date.getDate();

		get_timetable({}, function(){});
	});

	// ＜ 前へ（前日、前週、前月）ボタンクリックハンドラ
	$("#back").click(function() {

		//PC? or SP? フラグを再取得
		$flg_screensize_pc = $("#screensize_pc").is(':visible') ? true : false;

		// SameSite対策 ユーザエージェントがiOS12 およびMacOS 10.14 の場合は対応しない
		var agent = window.navigator.userAgent.toLowerCase();
		var addSamesite = "";
		if (
			agent.indexOf('iphone os 12') == -1
			&& agent.indexOf('ipad; cpu os 12') == -1
			&& agent.indexOf('mac os x 10_14') == -1
		) {
			addSamesite = "; SameSite=None;Secure";
		}

		// 変更前をとっておく
		var org_m = parseInt(cur_month, 10);

		// 日付をずらす
		if($flg_screensize_pc){
			//pcの処理
			var view_mode = $("#view_mode li.select").val();
		} else {
			//SPの処理
			var view_mode = $('#screensize_sp option:selected').val();
		}
		if (view_mode == 1) {
			cur_day = cur_day - 1;
		} else if (view_mode == 2) {
			cur_day = cur_day - 7;
		} else if (view_mode == 3) {
			cur_month = cur_month - 1;
		}

		// Date型にする
		var date = new Date(cur_year, cur_month - 1, cur_day);

		if (view_mode == 3) {
			// 月が飛んでいないか確認する
			var m = parseInt(date.getMonth() + 1, 10);
			if ((org_m == 1 && m == 12) ||
				((org_m - 1) == m)) {
				// この状態ならOK
			} else {
				// 5/31 で1ヵ月動かして 5/1 になってしまうような場合（4/31 がないから）
				cur_day = 1;	// 日付を1日にする
				date = new Date(cur_year, cur_month - 1, cur_day);	// 月は 0:1月, 1:2月 ... 11:12月
			}
		}

		cur_year = date.getFullYear();
		cur_month = date.getMonth() + 1;
		cur_day = date.getDate();

		get_timetable({}, function(){});
	});

	// 検索項目 カテゴリ チェンジハンドラ
	if ($categ_select.length > 0) {
		$categ_select.change(function() {
			get_timetable({}, function(){});
		});
	}
	// 検索項目 メインメニュー チェンジハンドラ
	if ($mplan_select.length > 0) {
		$mplan_select.change(function() {
			get_timetable({}, function(){});
		});
	}
	// 検索項目 担当チェンジ ハンドラ
	if ($staff_select.length > 0) {
		$staff_select.change(function() {
			get_timetable({}, function(){});
		});
	}

	// 日表示/週表示/月表示 切り替え
	function view_mode_handler($obj)
	{

		//PC? or SP? フラグを再取得
		$flg_screensize_pc = $("#screensize_pc").is(':visible') ? true : false;

		if (!$obj) {
			if($flg_screensize_pc){
				//PCの処理
				$view_mode.removeClass('select');
				$view_mode.eq(0).addClass('select');
			} else {
				//SPの処理
				$('#screensize_sp').val(1);
			}
		} else {
			if($flg_screensize_pc){
				//PCのみ、liに選択クラスを付与する
				$view_mode.removeClass('select');
				$obj.addClass('select');
			}

			//共通処理
			$("#today").hide();
			$("#thisweek").hide();
			$("#thismonth").hide();

			if ($obj.val() == 1) {
				$("#today").css('display', 'flex');
				$('#screensize_sp').val(1);
			}
			if ($obj.val() == 2) {
				$("#thisweek").css('display', 'flex');
				$('#screensize_sp').val(2);
			}
			if ($obj.val() == 3) {
				$("#thismonth").css('display', 'flex');
				$('#screensize_sp').val(3);
			}
		}
	}

	// 一覧表示 切り替え
	function view_list_handler()
	{
		if ($("#view_list li.select").length) {
			$view_list.removeClass('select');
		} else {
			$view_list.addClass('select');
		}
	}

	// タイムテーブルを取ってくる関数
	function get_timetable(option, callback)
	{
		var data = {};

		// ロード中を表示
		$loading_timetable.show();

		var url = "get_timetable_pc.php";

		if (option.url != undefined && option.url) {
			url = option.url;
		} else {
			// 必要なデータの整形
			// 表示モード取得
			//PC？ or SP？ によって、値を取得するためのセレクタを変更する
			data.view_mode = $flg_screensize_pc ? DEF_VIEW_MODE[$("#view_mode li.select").val()] : DEF_VIEW_MODE[$("#screensize_sp option:selected").val()];
			data.view_list = ($("#view_list li.select").length == 1)? 1: 0;
			data.relation_mp = relation_mp;
			$("input[name='view_mode']").val(data.view_mode);
			$("input[name='view_list']").val(data.view_list);
			// 日付の取得
			data.cur_year = cur_year;
			data.cur_month = cur_month;
			data.cur_day = cur_day;
			$("input[name='cur_year']").val(data.cur_year);
			$("input[name='cur_month']").val(data.cur_month);
			$("input[name='cur_day']").val(data.cur_day);
			// カテゴリの取得
			if ($categ_select.length > 0) {
				data.cur_categ_id = $(":selected", $categ_select).val();
				$("input[name='cur_categ_id']").val(data.cur_categ_id);
			}
			// メインメニューの取得
			if ($mplan_select.length > 0) {
				data.cur_mp_id = $(":selected", $mplan_select).val();
				$("input[name='cur_mp_id']").val(data.cur_mp_id);
			}
			// 担当の取得
			if ($staff_select.length > 0) {
				data.cur_staff_id = $(":selected", $staff_select).val();
				$("input[name='cur_staff_id']").val(data.cur_staff_id);
			}
			// 一覧表示 現在のページ
			if (data.view_list == 1) {
				data.pager_current = pager_current;
			}
			pager_current = 1;
			// 管理からの予約
			data.reserve_mode = cur_reserve_mode;	// 管理からの予約
			// ユーザ予約変更
			data.reserve_mode_user = cur_reserve_mode_user;
			// ゲスト予約変更
			data.cancel_guest_hash = cur_cancel_guest_hash;
		}

		// ajax
		$.ajax({
			dataType: "html"
			, success: function(html, state, xhr) {
				$timetable.empty();
				$loading_timetable.hide();
				$timetable.html(html);

				$timetable.removeClass('month_screen_small_witdh');

				// タイムラインのハンドラ
				$(".time-line").on("mouseenter", function(event) {
					var viewMode = DEF_VIEW_MODE[$("#view_mode li.select").val()];
					var $this = $(this);
					if (timer_baloon !== false) {
						clearTimeout(timer_baloon);
						hide_baloon();
					}
					timer_baloon = setTimeout(function() {
						$this.data("z-index", $this.css("z-index"));
						$this.css("z-index", 10000);
						show_baloon($this, event);
					}, 500);
				}).on("mouseleave", function() {
					$(this).css("z-index", $(this).data("z-index"));
					hide_baloon();
				}).on("click", function() {
					if ($(".detail_link", this).length <= 0) {
						return false;
					}
					window.onbeforeunload = null;
					location.href = $(".detail_link", this).attr("href");
				});

				hide_baloon();

			}
			, error: function(xhr, state, e) {
				location.href="calendar.php";
			}
			, beforeSend : function(xhr) {
				xhr.overrideMimeType('text/html; charset=UTF-8');
			}
			, type: "GET"
			, url: url
			, data: data
			, cache: false
		});

		return callback(data);
	}

	// 日表示に切り替える
	function change_view_mode_day(t_year, t_month, t_day)
	{
		cur_year = t_year;
		cur_month = t_month;
		cur_day = t_day;

		// SameSite対策 ユーザエージェントがiOS12 およびMacOS 10.14 の場合は対応しない
		var agent = window.navigator.userAgent.toLowerCase();
		var addSamesite = "";
		if (
			agent.indexOf('iphone os 12') == -1
			&& agent.indexOf('ipad; cpu os 12') == -1
			&& agent.indexOf('mac os x 10_14') == -1
		) {
			addSamesite = "; SameSite=None;Secure";
		}

		// 表示を切り替える。
		view_mode_handler($("#view_mode_d"));

		get_timetable({}, function(){});
	}

	// バルーン表示
	function show_baloon($target_obj, event)
	{
		var o = $("#main").offset();
		var offset = $target_obj.offset();
		var target_top = offset.top - o.top;
		var target_left = offset.left - o.left;
		var target_height = $target_obj.height();
		var target_width = $target_obj.width();

		var table_offset = $timetable.offset();
		var table_height = $timetable.height();
		var table_width = $timetable.width();

		var base_x = table_offset.left - o.left + (table_width / 2);
		var base_y = table_offset.top - o.top + (table_height / 2);

		var position = 1;
		if (DEF_VIEW_MODE[$("#view_mode li.select").val()] == "day") {
			// 日表示の場合は
			// 左上にだす
			position = 5;
		} else if (base_x < target_left && base_y > target_top) {
			// 右上にあるので
			// 左下にだす
			position = 1;
		} else if (base_x > target_left && base_y > target_top) {
			// 左上にあるので
			// 右下に出す
			position = 2;
		} else if (base_x > target_left && base_y < target_top) {
			// 左下にあるので
			// 右上に出す
			position = 3;
		} else if (base_x < target_left && base_y < target_top) {
			// 右下にあるので
			// 左上に出す
			position = 4;
		}

		var data = { timetbl_mp_id:  $target_obj.attr("keyid")};
		data.reserve_mode = cur_reserve_mode;	// 管理からの予約
		data.reserve_mode_user = cur_reserve_mode_user;	// ユーザ予約変更
		data.cancel_guest_hash = cur_cancel_guest_hash;	// ゲスト予約変更
		var url = "get_baloon.php";

		// ajax
		$.ajax({
			dataType: "html"
			, success: function(html, state, xhr) {
				$("#res-detail").html(html).ready(function() {
					var baloon_height = $("#baloon_area").show().height();
					var baloon_width = $("#baloon_area").width();

					var top = 0;
					var left = 0;

					// バルーンの位置決め
					switch (position) {
					case 1:	// 左下に出す
					default:
						top = (target_top * 1) + (target_height / 2);
						left = (target_left * 1) - baloon_width;
						break;

					case 2:	// 右下に出す
						top = (target_top * 1) + (target_height / 2);
						left = (target_left * 1) + target_width;
						break;

					case 3:	// 右上に出す
						top = (target_top * 1) - baloon_height;
						left = (target_left * 1) + (target_width / 2);
						break;

					case 4:	// 左上に出す
						top = (target_top * 1) - baloon_height;
						left = (target_left * 1) - baloon_width;
						break;

					case 5:	// 左上に出す(日表示)
						top = (target_top * 1) - baloon_height;
						left = (target_left * 1);
						break;
					}

					$("#baloon_area").css({"top":top+"px", "left":left+"px"}).show();
				});

			}
			, error: function(xhr, state, e) {
				hide_baloon();
			}
			, beforeSend : function(xhr) {
				xhr.overrideMimeType('text/html; charset=UTF-8');
			}
			, type: "GET"
			, url: url
			, data: data
			, cache: false
		});
	}

	// バルーン非表示
	function hide_baloon()
	{
		$("#baloon_area").css({"top":0, "left":0}).hide();
		$("#res-detail").empty();
	}

	// 日付の妥当性をチェック
	function checkdate(m, d, y, dateobj)
	{
		// 引数を整数にする
		var yy = parseInt(y, 10);
		var mm = parseInt(m, 10);
		var dd = parseInt(d, 10);

		if ((dateobj.getFullYear() == yy) &&
			(dateobj.getMonth() == (mm - 1)) &&
			(dateobj.getDate() == dd)) {
			return true;
		} else {
			return false;
		}
	}

	// 画面幅が境界値（引数の値）以下か？
	function isScreenWidthSmallerThan(boundary)
	{
		var windowInnerWidth = window.innerWidth;

		if (windowInnerWidth <= boundary) {
			return true;
		} else {
			return false;
		}
	}

	// 現在のviewMode
	function currentViewMode()
	{
		return DEF_VIEW_MODE[$("#view_mode li.select").val()];
	}

});

