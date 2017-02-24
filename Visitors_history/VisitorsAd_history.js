/// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />
/// <reference path= "../PageParsers/2_IDictionary.ts" />
/// <reference path= "../PageParsers/7_PageParserFunctions.ts" />
/// <reference path= "../PageParsers/1_Exceptions.ts" />
$ = jQuery = jQuery.noConflict(true);
$xioDebug = true;
function Start() {
    if (isMyUnitList())
        unitList();
    if (isUnitMain())
        unitMain();
    if (isVisitorsHistory())
        showHistory();
    logDebug("На не юнитлисте и не на главной магазина");
}
function unitList() {
}
function unitMain() {
    if (!isShop()) {
        logDebug("не магазин.");
        return;
    }
    // подставляем линк на график истории посетосов и рекламы
    var $td = $('tr:contains("Количество посетителей") td:eq(1)');
    $td.append("<br/>");
    $td.append("<a href=\"" + (document.location.pathname + "/visitors_history") + "\">\u0438\u0441\u0442\u043E\u0440\u0438\u044F</a>");
}
function showHistory() {
}
$(document).ready(function () { return Start(); });
//# sourceMappingURL=VisitorsAd_history.js.map