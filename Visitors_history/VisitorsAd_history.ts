
/// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />
/// <reference path= "../../XioPorted/PageParsers/2_IDictionary.ts" />
/// <reference path= "../../XioPorted/PageParsers/7_PageParserFunctions.ts" />
/// <reference path= "../../XioPorted/PageParsers/1_Exceptions.ts" />

$ = jQuery = jQuery.noConflict(true);
$xioDebug = true;
let realm = getRealmOrError();
let companyId = getCompanyId();
let currentGameDate = parseGameDate(document, document.location.pathname);
let dataVersion = 2;    // версия сохраняемых данных. При изменении формата менять и версию

// старый упрощенный интерфейс
//interface IVisitorsInfo {
//    date: Date;
//    visitors: number;
//    celebrity: number;
//    budget: number;
//    population: number;
//}

// новый расширенный
interface IVisitorsInfoEx {
    date: Date;

    visitors: number;
    service: ServiceLevels; // уровень сервиса
    income: number;         // выручка

    celebrity: number;      // известность
    budget: number;         // рекламный бюджет
    population: number;     // население города
}

// сжатый формат для сохранения. даты переведены в строки
interface ICompactInfo {
    dt: string;
    vs: number;     // посы
    cb: number;     // известн
    bg: number;     // бюджет
    pp: number;     // насел
    sr: ServiceLevels; // уровень сервиса
    ic: number;         // выручка
}
/**
 * Укорачивает имена ключей для удобного сохранения. дабы не засерало кучу места.
 * Так же даты переводит в короткую форму строки
 * @param info
 */
function compact(info: IDictionary<IVisitorsInfoEx>): IDictionary<ICompactInfo> {

    let compacted: IDictionary<ICompactInfo> = {};
    for (let dateKey in info) {
        let item = info[dateKey];
        let cmpct: ICompactInfo = {
            dt: dateToShort(item.date),

            vs: item.visitors,
            sr: item.service,
            ic: item.income,

            cb: item.celebrity,
            bg: item.budget,
            pp: item.population
        };

        compacted[dateKey] = cmpct;
    }

    return compacted;
}

/**
 * Из сжатого формата получаем полноценный формат. Восстанавливает даты из строки
 * @param compacted
 */
function expand(compacted: IDictionary<ICompactInfo>): IDictionary<IVisitorsInfoEx> {

    let expanded: IDictionary<IVisitorsInfoEx> = {};
    for (let dateKey in compacted) {
        let item = compacted[dateKey];
        let exp: IVisitorsInfoEx = {
            date: dateFromShort(item.dt),

            visitors: item.vs,
            service: item.sr,
            income: item.ic,

            celebrity: item.cb,
            budget: item.bg,
            population: item.pp
        };

        expanded[dateKey] = exp;
    }

    return expanded;
}


// упрощаем себе жисть, подставляем имя скрипта всегда в сообщении
function log(msg: string, ...args: any[]) {

    msg = "visitors: " + msg;
    let arr: any[] = [];
    arr.push(msg);
    arr.push.apply(arr, args);
    logDebug.apply(null, arr);
}


function Start() {
    if (isMyUnitList())
        unitList();

    if (isUnitMain(document.location.pathname, document))
        unitMain();

    //if (isVisitorsHistory())
    //    showHistory();

    log("закончили");
}

function unitList() {

    let $header = $("div.metro_header");

    let $vh = $("<div id='visitorsHistory'></div>");
    let $parseBtn = $("<input type='button' id='vh_parseVisitors' value='Parse Visitors'>");
    let $logVisitors = $("<span id='logVisitors'></span>");
    let $logAd = $("<span id='logAd'></span>");

    
    // парсить данные если сегодня еще не парсили, тогда блинкать кнопку дабы не забыть
    let lastDate = localStorage[buildStoreKey(realm, "vh")];
    let today = dateToShort(currentGameDate);
    if (lastDate !== today) {
        setInterval(() => {
            if ($parseBtn.hasClass("blink")) {
                $parseBtn.css("background", "");
                $parseBtn.removeClass("blink");
            }
            else {
                $parseBtn.css("background", "red");
                $parseBtn.addClass("blink");
            }
        }, 1000);
    }

    $parseBtn.on("click", async (event) => {
        $parseBtn.prop("disabled", true);
        try {
            let parsedInfo = await parseVisitors_async();
            log("parsedInfo", parsedInfo);
            saveInfo(parsedInfo);
            // запишем так же флаг что сегодня уж парсили. а то кнопка блинкать будет
            localStorage[buildStoreKey(realm, "vh")] = today;
        }
        catch (err) {
            log("ошибка сбора и сохранения информации", err);
            throw err;
        }
        finally {
            $parseBtn.prop("disabled", false);
        }
    });
    $vh.append($parseBtn).append($logVisitors).append($logAd);
    

    // зачистить старую историю
    let $clearBtn = $("<input type='button' id='vh_clearOld' value='Clear'>");
    $clearBtn.on("click", () => {
        let keys = Object.keys(localStorage);
        keys = keys.filter((val, i, arr) => val.indexOf("vh") === 0);
        log("parser ", keys);
        keys.forEach((val, i, arr) => localStorage.removeItem(val));
    });
    //$vh.append($clearBtn);

    // конвертировать кэш. юзать в особых случаях когда шибко надо
    let $convertBtn = $("<input type='button' id='vh_convert' value='Convert'>");
    $convertBtn.on("click", () => {
        //let keys = Object.keys(localStorage);
        //// ^*_olga_6495838vh
        //let oldkeys = keys.filter((val, i, arr) => {
        //    // если в ключе нет числа, не брать его
        //    let m = extractIntPositive(val);
        //    if (m == null)
        //        return false;

        //    // если ключик не совпадает со старым ключем для посетителей
        //    let subid = m[0];
        //    if (val !== buildStoreKey(realm, subid + "vh"))
        //        return false;

        //    return true;
        //});
        //log("old", oldkeys);

        //oldkeys.forEach((val, i, arr) => {
            
        //    // забираем старый формат
        //    let storedOld = JSON.parse(localStorage[val], function (this: any, key: any, val: any) {
        //        if (key === "date")
        //            return dateFromShort(val); // храним в своем коротком формате даты

        //        return val;
        //    }) as IDictionary<IVisitorsInfo>;

        //    // конвертаем в новый формат
        //    let storedNew: [number, IDictionary<IVisitorsInfoEx>] = [dataVersion, {}];
        //    for (let dateKey in storedOld) {
        //        let oldItem = storedOld[dateKey];
        //        let newItem: IVisitorsInfoEx = {
        //            date: oldItem.date,
        //            visitors: oldItem.visitors,
        //            service: ServiceLevels.none,
        //            income: 0,
        //            celebrity: oldItem.celebrity,
        //            budget: oldItem.budget,
        //            population: oldItem.population
        //        };

        //        storedNew[1][dateKey] = newItem;
        //    }

        //    // конвертаем в сериализованный формат
        //    let compacted: [number, IDictionary<ICompactInfo>] = [storedNew[0], compact(storedNew[1])];

        //    // сохраняем с правильным ключиком
        //    let m = extractIntPositive(val);
        //    if (m == null)
        //        throw new Error ("что то пошло не так");

        //    let subid = m[0];
        //    let storeKey = buildStoreKey(realm, "vh", subid);
        //    log("created", storeKey, compacted);
        //    localStorage[storeKey] = JSON.stringify(compacted);

        //    // удаляем старый ключик
        //    localStorage.removeItem(val);
        //    log("removed", val);
        //});

    });
    //$vh.append($convertBtn);

    // экспортировать данные
    let $exportBtn = $("<input type='button' id='vh_export' value='Export'>");
    $exportBtn.on("click", () => {
        Export($header, (key) => {
            // если в ключе нет числа, не брать его
            let m = extractIntPositive(key);
            if (m == null)
                return false;

            // если ключик не совпадает со старым ключем для посетителей
            let subid = m[0];
            if (key !== buildStoreKey(realm, "vh", subid))
                return false;

            return true;
        });
    });
    $vh.append($exportBtn);

    // импортировать данные
    let $importBtn = $("<input type='button' id='vh_import' value='Import'>");
    $importBtn.on("click", () => {
        Import($header);
    });
    $vh.append($importBtn);

    $header.append($vh);

    // собираем всю информацию по магазинам включая рекламу и доходы
    async function parseVisitors_async() {
        try {
            // парсим список магов со страницы юнитов
            let p1 = await getShops_async();
            let subids = p1 as number[];
            log("shops", subids);

            // парсим профиты магов с отчета по подразделениям
            let p2 = await getProfits_async();
            let finance = p2 as IDictionaryN<IUnitFinance>;
            log("finance", finance);

            // число элементов должно совпадать иначе какой то косяк
            if (subids.length !== Object.keys(finance).length)
                throw new Error("Число юнитов с главной, не совпало с числом юнитов взятых с отчета по подразделениям. косяк.");

            // теперь для каждого мага надо собрать информацию по посетосам и бюджету
            // для полученного списка парсим инфу по посетителям, известности, рекламному бюджету
            // !!!!!! использовать forEach оказалось опасно. Так как там метод, он быстро выполнялся БЕЗ ожидания
            // завершения промисов и я получал данные когда то в будущем. Через циклы работает
            let parsedInfo: IDictionaryN<IVisitorsInfoEx> = {};
            for (let subid of subids) {
                // собираем данные по юниту и дополняем недостающим
                let info = await getUnitInfo_async(subid);
                info.date = currentGameDate;
                info.income = finance[subid].income;    // если вдруг данных не будет все равно вывалит ошибку

                if (parsedInfo[subid])
                    throw new Error("юнита еще не должно быть в списке спарсеных " + subid);

                parsedInfo[subid] = info;
            }
            
            return parsedInfo;
        }
        catch (err) {
            log("Ошибка сбора посетителей.", err);
            throw err;
        }
    }

    function saveInfo(parsedInfo: IDictionaryN<IVisitorsInfoEx>) {
        for (let key in parsedInfo) {
            let subid = parseInt(key);
            let info = parsedInfo[subid];

            let storeKey = buildStoreKey(realm, "vh", subid);
            let dateKey = dateToShort(info.date);

            // компактифицируем данные по юниту
            let dic: IDictionary<IVisitorsInfoEx> = {};
            dic[dateKey] = info;
            let compactInfo = compact(dic)[dateKey];

            
            // если записи о юните еще нет, сформируем иначе считаем данные
            let storedInfo: [number, IDictionary<ICompactInfo>] = [dataVersion, {}];
            if (localStorage[storeKey] != null)
                storedInfo = JSON.parse(localStorage[storeKey]);

            // обновим данные и сохраним назад
            storedInfo[1][dateKey] = compactInfo;
            localStorage[storeKey] = JSON.stringify(storedInfo);
        }
    }


    // собирает, число посетителей, сервис, известность, бюджет, население.
    async function getUnitInfo_async(subid: number): Promise<IVisitorsInfoEx> {
        try {
            // собираем странички
            let urlMain = `/${realm}/main/unit/view/${subid}`;
            let urlAdv = `/${realm}/main/unit/view/${subid}/virtasement`;
            let htmlMain = await tryGet_async(urlMain);
            let htmlAdv = await tryGet_async(urlAdv);

            // парсим данные
            let adv = parseAds(htmlAdv, urlAdv);
            let main = parseUnitMain(htmlMain, urlMain);
            let res: IVisitorsInfoEx = {
                date: new Date(),
                income: -1,

                visitors: main.visitors,
                service: main.service,

                celebrity: adv.celebrity,
                budget: adv.budget,
                population: adv.pop
            };
            return res;
        }
        catch (err) {
            log("ошибка получения данных по юниту " + subid, err);
            throw err;
        }
    }

    // получает список subid для всех наших магазинов
    async function getShops_async(): Promise<number[]> {

        // ставим фильтрацию на магазины, сбрасываем пагинацию.
        // парсим юниты, 
        // восстанавливаем пагинацию и фильтрацию
        try {
            // ставим фильтр в магазины и сбросим пагинацию
            await tryGet_async(`/${realm}/main/common/util/setfiltering/dbunit/unitListWithProduction/class=1885/type=0/size=0`);
            await tryGet_async(`/${realm}/main/common/util/setpaging/dbunit/unitListWithProduction/20000`);

            // забрали страничку с юнитами
            let html = await tryGet_async(`/${realm}/main/company/view/${companyId}/unit_list`);

            // вернем пагинацию, и вернем назад установки фильтрации
            await tryGet_async(`/${realm}/main/common/util/setpaging/dbunit/unitListWithProduction/400`);
            await tryGet_async($(".u-s").attr("href") || `/${realm}/main/common/util/setfiltering/dbunit/unitListWithProduction/class=0/size=0/type=${$(".unittype").val()}`);

            // обработаем страничку и вернем результат
            let shops = parseUnitList(html, document.location.pathname);
            let arr: number[] = [];
            for (let key in shops) {
                if (shops[key].type !== UnitTypes.shop)
                    throw new Error("мы должны получить только магазины, а получили " + shops[key].type);

                arr.push(shops[key].subid);
            }

            return arr;
        }
        catch (err)
        {
            log("ошибка запроса юнитов.", err);
            throw err;
        }
    }

    // забирает данные со странички отчета по подразделениям. А именно выручку по всем нашим магам
    async function getProfits_async(): Promise<IDictionaryN<IUnitFinance>> {
        try {
            // сбросим пагинацию и заберем только отчет для магазинов. после чего вернем пагинацию
            await tryGet_async(`/${realm}/main/common/util/setpaging/reportcompany/units/20000`);
            let reportUrl = `/${realm}/main/company/view/${companyId}/finance_report/by_units/class:1885/`;
            let html = await tryGet_async(reportUrl);
            await tryGet_async(`/${realm}/main/common/util/setpaging/reportcompany/units/400`);

            // обработаем полученную страничку
            let profits = parseFinanceRepByUnits(html, reportUrl);
            return profits;
        }
        catch (err) {
            log("ошибка обработки отчета по подразделениям", err);
            throw err;
        }
    }


    // шляпа что рисуется сверху и показывает результаты
    function buildTable() {
        return `<div id='rmTabletitle' class='rmProperty' style='font-size: 24px; color:gold; margin-bottom: 5px; margin-top: 15px;'>RM Maintenance Log</div>
            <table id='rmTable' class='rmProperty' style='font-size: 18px; color:gold; border-spacing: 10px 0; margin-bottom: 18px'>
                <tr id='rmSplit'></tr>
                <tr>
                    <td>New suppliers: </td>
                    <td id='rmSuppliers'>0</td>
                </tr>
                <tr>
                    <td>Get calls: </td>
                    <td id='rmGetCalls'>0</td>
                </tr>
                <tr>
                    <td>Post calls: </td>
                    <td id='rmPostCalls'>0</td>
                </tr>
                <tr>
                    <td>Total server calls: </td>
                    <td id='rmServerCalls'>0</td>
                </tr>
                <tr>
                    <td>Time: </td>
                    <td id=rmMinutes>0</td>
                    <td>min</td>
                    <td id='rmSeconds'>0</td>
                    <td>sec</td>
                </tr>
                <tr>
                    <td id='xDone' colspan=4 style='visibility: hidden; color: lightgoldenrodyellow'>All Done!</td>
                    <td id='xFail' colspan=4 style='visibility: hidden; color: lightgoldenrodyellow'>Failed!</td>
                </tr>
            </table>
        <div id='rmProblem' class='rmProperty style='font-size: 18px; color:gold;'></div>`;
    }

    function progress(msg: string) {
        //serverGets++;
        //$("#rmGetCalls").text(serverGets);
        //$("#rmServerCalls").text(serverGets + serverPosts);
        //log(msg);
    }
}

function unitMain() {
    if (!isShop(document)) {
        log("не магазин.");
        return;
    }

    // подставляем линк на график истории посетосов и рекламы
    let $td = $('tr:contains("Количество посетителей") td:eq(1)');
    let $a = $("<a id='history' class='popup'>история</a>").css("cursor", "pointer");
    $a.on("click", (event) => {
        let $cont = $("#chartContainer");
        if ($cont.length === 0) {
            let $r = $a.closest("tr");
            $r.after(`<tr">
                        <td colspan=3>
                            <div id="chartContainer" style="display:block; width:100%; height:600px"></div>
                        </td>
                     </tr>`);

            let info = loadInfo(getSubid());
            showHistory(info, $("#chartContainer"));
        }
        else {
            $cont.closest("tr").remove();
        }
        
    });

    $td.append("<br/>").append($a);
}

// выводит график
function showHistory(info: IDictionary<IVisitorsInfoEx>, container: JQuery) {

    // сортируем данные по дате по возрастанию
    let arr: IVisitorsInfoEx[] = [];
    for (let k in info)
        arr.push(info[k]);

    arr.sort((a, b) => {
        if (a.date > b.date)
            return 1;

        if (a.date < b.date)
            return -1;

        return 0;
    });

    log("info ", arr);

    let chart = AmCharts.makeChart(container.get(0), {
        "type": "serial",
        "categoryField": "date",
        "columnWidth": 0.8,
        "dataDateFormat": "",
        "mouseWheelZoomEnabled": true,
        "synchronizeGrid": true,
        "gridAboveGraphs": true,
        "sequencedAnimation": false,
        "accessible": false,
        "autoDisplay": true,
        "panEventsEnabled": false,
        "path": "https://cdn.amcharts.com/lib/3/",
        "tapToActivate": false,
        "thousandsSeparator": " ",
        "usePrefixes": true,
        "categoryAxis": {
            "parseDates": true,
            "tickPosition": "start",
            "titleBold": false
        },
        "chartCursor": {
            "enabled": true,
            "animationDuration": 0,
            "categoryBalloonDateFormat": "DD.MM.YYYY",
            "cursorAlpha": 0.1,
            "cursorColor": "#ED8C8C",
            "cursorPosition": "mouse",
            "fullWidth": true,
            "selectionAlpha": 0.5
        },
        "chartScrollbar": {
            "enabled": true,
            "autoGridCount": true
        },
        "graphs": [
            {
                "id": "ch-visitors",
                "bullet": "round",
                "bulletSize": 6,
                "lineColor": "#FF0000",
                "lineThickness": 2,
                "title": "посетители",
                "valueAxis": "y-visitors",
                "valueField": "visitors"
            },
            {
                "id": "ch-celebrity",
                "fillAlphas": 0.5,
                "fillColors": "#AAB3B3",
                "lineThickness": 0,
                "title": "известность",
                "type": "smoothedLine",
                "valueAxis": "y-celebrity",
                "valueField": "celebrity"
            },
            {
                "id": "ch-budget",
                "hidden": true,
                "lineColor": "#0000FF",
                "lineThickness": 3,
                "title": "бюжет",
                "type": "step",
                "valueAxis": "y-budget",
                "valueField": "budget"
            },
            {
                "id": "ch-turnover",
                "bullet": "square",
                "lineColor": "#DADA18",
                "title": "выручка",
                "type": "smoothedLine",
                "valueAxis": "y-turnover",
                "valueField": "income"
            },
            {
                "id": "ch-service",
                "hidden": false,
                "lineColor": "black",
                "lineThickness": 2,
                "title": "сервис",
                "type": "step",
                "valueAxis": "y-service",
                "valueField": "service"
            },
        ],
        "valueAxes": [
            {
                "id": "y-budget",
                "position": "left",
                "axisColor": "#0000FF",
                "axisThickness": 2,
                "color": "#0000FF",
                "offset": 50,
            },
            {
                "id": "y-service",
                "position": "right",
                "axisColor": "black",
                "axisThickness": 2,
                "color": "black",
                "offset": 100,
            },
            {
                "id": "y-visitors",
                "position": "right",
                "axisColor": "#FF0000",
                "axisThickness": 2,
                "color": "#FF0000",
            },
            {
                "id": "y-celebrity",
                "position": "left",
                "axisColor": "#AAB3B3",
                "axisThickness": 2,
                "color": "#AAB3B3",
            },
            {
                "id": "y-turnover",
                "position": "right",
                "axisColor": "#DADA18",
                "axisThickness": 2,
                "color": "#DADA18",
                "offset": 50
            }
        ],
        "legend": {
            "enabled": true,
            "useGraphSettings": true
        },
        "dataProvider": arr
    });
    chart.invalidateSize();
    //log("showed");
}

// загрузка данных по 1 юниту и конвертация в нормальный формат
function loadInfo(subid: number): IDictionary<IVisitorsInfoEx> {

    let storeKey = buildStoreKey(realm, "vh", subid);
    let compacted = JSON.parse(localStorage[storeKey]) as [number, IDictionary<ICompactInfo>];
    let expanded = expand(compacted[1]);
    return expanded;
}

function getSubid() {
    let numbers = extractIntPositive(document.location.pathname);
    if (numbers == null || numbers.length < 1)
        throw new Error("Не смогли спарсить subid юнита со ссылки");

    return numbers[0];
}



$(document).ready(() => Start());