// ==UserScript==
// @name           Virtonomica: Visitors and Advertisments history
// @namespace      virtonomica
// @author         ra81
// @description    Сохранение и вывод информации о посетосах и рекламном бюджете и известности
// @include        http*://virtonomic*.*/*/main/unit/view/*
// @include        http*://virtonomic*.*/*/main/company/view/*/unit_list
// @require        https://code.jquery.com/jquery-1.11.1.min.js
// @require        https://www.amcharts.com/lib/3/amcharts.js
// @require        https://www.amcharts.com/lib/3/serial.js
// @require        https://raw.githubusercontent.com/pieroxy/lz-string/master/libs/lz-string.min.js
// @version        2.2
// ==/UserScript==

/// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />
/// <reference path= "../../XioPorted/PageParsers/2_IDictionary.ts" />
/// <reference path= "../../XioPorted/PageParsers/7_PageParserFunctions.ts" />
/// <reference path= "../../XioPorted/PageParsers/1_Exceptions.ts" />
