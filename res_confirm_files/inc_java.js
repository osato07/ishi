/*使用していない する場合は BT_Word::translate("BT_SYS_JS_RESCANCEL") を渡す */
function message_cancel_res(str)
{	f = confirm(str);
	return f
}

function initRollovers()
{
	if (!document.getElementById) return

	var aPreLoad = new Array();
	var sTempSrc;
	var aImages = document.getElementsByTagName('img');

	for (var i = 0; i < aImages.length; i++) {
		if (aImages[i].className == 'btn') {
			var src = aImages[i].getAttribute('src');
			var ftype = src.substring(src.lastIndexOf('.'), src.length);
			var hsrc = src.replace(ftype, '_f2'+ftype);

			aImages[i].setAttribute('hsrc', hsrc);

			aPreLoad[i] = new Image();
			aPreLoad[i].src = hsrc;

			aImages[i].onmouseover = function() {
				sTempSrc = this.getAttribute('src');
				this.setAttribute('src', this.getAttribute('hsrc'));
			}

			aImages[i].onmouseout = function() {
				if (!sTempSrc) sTempSrc = this.getAttribute('src').replace('_f2'+ftype, ftype);
				this.setAttribute('src', sTempSrc);
			}
		}
	}
}

window.onload = initRollovers;


function CallZip(obj_form, obj_zip1, obj_zip2, obj_addr1, obj_addr2, errmess1, errmess2, errmess3)
{
	var strZIP;
	var strZIP1 = obj_zip1.value;
	var strZIP2;
	var zip2name = "";

	if (obj_zip2) {
		strZIP2 = obj_zip2.value;
	}

	var Re = /^[0-9]+$/;

	if (strZIP1.match(Re) == null) {
		alert(errmess1);
		return;
	}
	if (obj_zip2) {
		if (strZIP2) {
			if (strZIP2.match(Re) == null) {
				alert(errmess2);
				return;
			}
			strZIP1 = strZIP1 + strZIP2;
		}
	}

	if (strZIP1.length >= 3) {
		SubWindow = window.open(
			"../callzip.php?zip="
				+ strZIP1
				+ "&form_name="				+ obj_form.name
				+ "&single_zip="			+ ((obj_zip2) ? "0" : "1")
				+ "&form_name_zip1="		+ obj_zip1.name
				+ "&form_name_zip2="		+ ((obj_zip2) ? obj_zip2.name : "")
				+ "&form_name_address1="	+ obj_addr1.name
				+ "&form_name_address2="	+ obj_addr2.name
			, "zip"
			, "resizable=yes,scrollbars=yes,menubar=yes,width=375,height=170,left=150,top=100"
		);
	} else {
		alert(errmess3);
		return;
	}
}

/**
 * This array is used to remember mark status of rows in browse mode
 */
var marked_row = new Array;


/**
 * Sets/unsets the pointer and marker in browse mode
 *
 * @param   object    the table row
 * @param   integer  the row number
 * @param   string    the action calling this script (over, out or click)
 * @param   string    the default background color
 * @param   string    the color to use for mouseover
 * @param   string    the color to use for marking a row
 *
 * @return  boolean  whether pointer is set or not
 */
function setPointer(theRow, theRowNum, theAction, theDefaultColor, thePointerColor, theMarkColor)
{
    var theCells = null;

    // 1. Pointer and mark feature are disabled or the browser can't get the
    //    row -> exits
    if ((thePointerColor == '' && theMarkColor == '')
        || typeof(theRow.style) == 'undefined') {
        return false;
    }

    // 2. Gets the current row and exits if the browser can't get it
    if (typeof(document.getElementsByTagName) != 'undefined') {
        theCells = theRow.getElementsByTagName('td');
    }
    else if (typeof(theRow.cells) != 'undefined') {
        theCells = theRow.cells;
    }
    else {
        return false;
    }

    // 3. Gets the current color...
    var rowCellsCnt  = theCells.length;
    var domDetect    = null;
    var currentColor = null;
    var newColor     = null;
    // 3.1 ... with DOM compatible browsers except Opera that does not return
    //         valid values with "getAttribute"
    if (typeof(window.opera) == 'undefined'
        && typeof(theCells[0].getAttribute) != 'undefined') {
        currentColor = theCells[0].getAttribute('bgcolor');
        domDetect    = true;
    }
    // 3.2 ... with other browsers
    else {
        currentColor = theCells[0].style.backgroundColor;
        domDetect    = false;
    } // end 3

    // 3.3 ... Opera changes colors set via HTML to rgb(r,g,b) format so fix it
    if (currentColor.indexOf("rgb") >= 0)
    {
        var rgbStr = currentColor.slice(currentColor.indexOf('(') + 1,
                                     currentColor.indexOf(')'));
        var rgbValues = rgbStr.split(",");
        currentColor = "#";
        var hexChars = "0123456789ABCDEF";
        for (var i = 0; i < 3; i++)
        {
            var v = rgbValues[i].valueOf();
            currentColor += hexChars.charAt(v/16) + hexChars.charAt(v%16);
        }
    }

    // 4. Defines the new color
    // 4.1 Current color is the default one
    if (currentColor == ''
        || currentColor.toLowerCase() == theDefaultColor.toLowerCase()) {
        if (theAction == 'over' && thePointerColor != '') {
            newColor              = thePointerColor;
        }
        else if (theAction == 'click' && theMarkColor != '') {
            newColor              = theMarkColor;
            marked_row[theRowNum] = true;
            // Garvin: deactivated onclick marking of the checkbox because it's also executed
            // when an action (like edit/delete) on a single item is performed. Then the checkbox
            // would get deactived, even though we need it activated. Maybe there is a way
            // to detect if the row was clicked, and not an item therein...
            // document.getElementById('id_rows_to_delete' + theRowNum).checked = true;
        }
    }
    // 4.1.2 Current color is the pointer one
    else if (currentColor.toLowerCase() == thePointerColor.toLowerCase()
             && (typeof(marked_row[theRowNum]) == 'undefined' || !marked_row[theRowNum])) {
        if (theAction == 'out') {
            newColor              = theDefaultColor;
        }
        else if (theAction == 'click' && theMarkColor != '') {
            newColor              = theMarkColor;
            marked_row[theRowNum] = true;
            // document.getElementById('id_rows_to_delete' + theRowNum).checked = true;
        }
    }
    // 4.1.3 Current color is the marker one
    else if (currentColor.toLowerCase() == theMarkColor.toLowerCase()) {
        if (theAction == 'click') {
            newColor              = (thePointerColor != '')
                                  ? thePointerColor
                                  : theDefaultColor;
            marked_row[theRowNum] = (typeof(marked_row[theRowNum]) == 'undefined' || !marked_row[theRowNum])
                                  ? true
                                  : null;
            // document.getElementById('id_rows_to_delete' + theRowNum).checked = false;
        }
    } // end 4

    // 5. Sets the new color...
    if (newColor) {
        var c = null;
        // 5.1 ... with DOM compatible browsers except Opera
        if (domDetect) {
            for (c = 0; c < rowCellsCnt; c++) {
                theCells[c].setAttribute('bgcolor', newColor, 0);
            } // end for
        }
        // 5.2 ... with other browsers
        else {
            for (c = 0; c < rowCellsCnt; c++) {
                theCells[c].style.backgroundColor = newColor;
            }
        }
    } // end 5

    return true;
} // end of the 'setPointer()' function


// F5 attack blocker
document.onkeydown = function(e) {
  if (e.which == 116) {
    return false;
  }
  return true;
}
document.onkeyup = function(e) {
  if (e.which == 116) {
    location.reload(true);
    return false;
  }
  return true;
}

// 注釈？アイコンのツールチップ表示/非表示
function questionGuideOnOff()
{
	$(".question-guide").on("click", function() {
		if ($(this).find(".guide-tooltip").is(':hidden')) {
			const target = $(this);
			display_tooltip(target);
		} else {
			$(this).find(".guide-tooltip").hide();
		}
	});

	hover_tooltip("question-guide");
}

function hover_tooltip(selector)
{
	$("." + selector).hover(
		function() {
			console.log($(this));
			const target = $(this);
			display_tooltip(target);
		},
		function() {
			$(this).find(".data-tooltip-body").hide();
		}
	);
}

function display_tooltip(target)
{
	// アイコンの真上にツールチップが位置するように微調整
	const position = target.position();
    let newPositionTop = "";
    if (!target.find(".guide-tooltip").hasClass("-upward")) {
        newPositionTop = position.top - target.find(".guide-tooltip").height() - 24;
    } else { // アイコンの真下にツールチップを表示する場合
        newPositionTop = position.top - target.find(".guide-tooltip").height() + 100;
    }

    const newPositionLeft = position.left - 2;
	target.find(".data-tooltip-body").css({"top": newPositionTop + "px", "left": newPositionLeft + "px"});
	target.find(".data-tooltip-body").show();
}
