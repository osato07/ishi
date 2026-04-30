$(function() {

  var allowClick = true;

	$(".btnDemo").click(function() {

    if(allowClick) {
      if ($(".btnDemo p").hasClass('btnDemoClose-multiline')) {
        //
        // 複数行表示 → 1行表示
        //
        document.cookie = 'trial_click=1; path=' + cookie_path;

        allowClick = false;

        $('.demoLogo').slideToggle(300);
        $('#navi').slideToggle(300);

        $(".btnDemo").css("background-color","transparent");
        $(".btnDemo i").hide();
        $(".btnDemo p").removeClass('btnDemoClose-multiline');
        $(".boxClose").removeClass('boxClose-multiline');

        setTimeout(function() {
          $(".btnDemo").css("height","24px");
          $(".btnDemo i").show();
          $(".btnDemo p").addClass('btnDemoClose-1line');
          $(".boxClose").addClass('boxClose-1line');
          allowClick = true;
        }, 350);
      } else {
        //
        // 1行表示 → 複数行表示
        //
        document.cookie = 'trial_click=0; path=' + cookie_path;

        allowClick = false;

        $('.demoLogo').slideToggle(300);
        $('#navi').slideToggle(300);

        $(".btnDemo i").hide();
        $(".btnDemo p").removeClass('btnDemoClose-1line');
        $(".boxClose").removeClass('boxClose-1line');

        setTimeout(function() {
          $(".btnDemo").css("height", "60px");
          $(".btnDemo").css("background-color","#eeeeee");
          $(".btnDemo i").show();
          $(".btnDemo p").addClass('btnDemoClose-multiline');
          $(".boxClose").addClass('boxClose-multiline');
          allowClick = true;
        }, 350);
      }
    }
  });
});
