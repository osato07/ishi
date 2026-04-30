// Easingの追加
jQuery.easing.quart = function (x, t, b, c, d) {
	return -c * ((t=t/d-1)*t*t*t - 1) + b;
};

/*-------------------------------------
 ページ読み込み中
-------------------------------------*/
jQuery(document).ready(function(){

	    var topBtn = $('#pagetop');
    topBtn.hide();
    $(window).scroll(function () {
      if ($(this).scrollTop() > 100) {
        topBtn.fadeIn();
      } else {
        topBtn.fadeOut();
      }
    });


	//
	// <a href="#***">の場合、スクロール処理を追加
	//
	jQuery("#pagetop a[href*='#']").click(function() {
		if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
			var $target = jQuery(this.hash);
			$target = $target.length && $target || jQuery('[name=' + this.hash.slice(1) +']');
			if ($target.length) {
				var targetOffset = $target.offset().top;
				jQuery('html,body').animate({ scrollTop: targetOffset }, 1200, 'quart');
				return false;
			}
		}
	});

});

function page_scroll(from_obj, to_obj){
    var i = from_obj.index(this)
    var p = to_obj.eq(i).offset().top;
    $('html,body').animate({scrollTop:p}, 'fast');
}

