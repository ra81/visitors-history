
/// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />
/// <reference path= "../../XioPorted/PageParsers/2_IDictionary.ts" />
/// <reference path= "../../XioPorted/PageParsers/7_PageParserFunctions.ts" />
/// <reference path= "../../XioPorted/PageParsers/1_Exceptions.ts" />

$ = jQuery = jQuery.noConflict(true);
$xioDebug = true;
let Realm = getRealmOrError();
let StoreKeyCode = "vh";
let companyId = getCompanyId();
let currentGameDate = parseGameDate(document, document.location.pathname);
let dataVersion = 2;    // версия сохраняемых данных. При изменении формата менять и версию
let KeepWeeks = 60;       // сколько точек данных сохранять. 52 значит виртогод

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

    // парсинг данных
    let $parseBtn = $("<input type='button' id='vh_parseVisitors' value='Parse Visitors'>");
    
    // если сегодня еще не парсили, тогда блинкать кнопку дабы не забыть
    let lastDate = localStorage[buildStoreKey(Realm, StoreKeyCode)];
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
            // формируем таблицу лога. внутри парсеров будут вызываться нотификаторы меняющие данные в таблице
            $(".logger").remove();
            $vh.append(buildTable());

            // проверим что дата спарсилась адекватно без косяков
            if (lastDate != null && currentGameDate < dateFromShort(lastDate))
                throw new Error(`Ошибка парсинга текущей даты. Последняя:${dateFromShort(lastDate)}, Спарсилось: ${dateToShort(currentGameDate)}`);

            // парсим данные
            let parsedInfo = await parseVisitors_async();

            log("parsedInfo", parsedInfo);
            $("#lgCurrent").hide();
            $("#lgAllDone").show();

            saveInfo(parsedInfo);
            // запишем так же флаг что сегодня уж парсили. а то кнопка блинкать будет
            localStorage[buildStoreKey(Realm, StoreKeyCode)] = today;

            $("#xDone").show();
        }
        catch (err) {
            log("ошибка сбора и сохранения информации", err);
            $("#xFail").show();
            let e = err as Error;
            $("#lgProblem").append(e.message + " => " + e.stack);
            throw err;
        }
        finally {
            $parseBtn.prop("disabled", false);
        }
    });
    $vh.append($parseBtn);
    

    // зачистить старую историю
    let $clearBtn = $("<input type='button' id='vh_clearOld' value='Clear'>");
    $clearBtn.on("click", () => {
        let keys = Object.keys(localStorage);
        keys = keys.filter((val, i, arr) => val.indexOf("vh") === 0);
        log("parser ", keys);
        keys.forEach((val, i, arr) => localStorage.removeItem(val));
    });
    //$vh.append($clearBtn);

    // зачистить удалить записи с несуществующих магов
    let $clearDeletedBtn = $("<input type='button' id='vh_clearDeleted' value='ClearDeleted'>");
    $clearDeletedBtn.on("click", async () => {
        $parseBtn.prop("disabled", true);
        try {
            // формируем таблицу лога. внутри парсеров будут вызываться нотификаторы меняющие данные в таблице
            $(".logger").remove();
            $vh.append(buildTable());

            // парсим список магов со страницы юнитов
            let p1 = await getShopsFuels_async();
            let subids = p1 as number[];
            log("shops", subids);

            // парсим профиты магов с отчета по подразделениям
            let p2 = await getProfits_async();
            let finance = p2 as IDictionaryN<IUnitFinance>;
            log("finance", finance);

            // число элементов должно совпадать иначе какой то косяк
            if (subids.length !== Object.keys(finance).length)
                throw new Error("Число юнитов с главной, не совпало с числом юнитов взятых с отчета по подразделениям. косяк.");

            // читаем из кэша все ключи и проверяем их наличие в списке юнитов. тех что нет, пишем в списко на удаление
            let removed: number[] = [];
            let stored = getStoredUnitsKeysA(Realm, StoreKeyCode);
            for (let [key, subid] of stored) {
                if (finance[subid] != null)
                    continue;

                if (isOneOf(subid, subids))
                    continue;

                removed.push(subid);
            }

            log("removed units", removed);
            notifyTotal(removed.length);

            // удаляем все старые
            let cnt = 0;
            for (let subid of removed) {
                notifyCurrent(subid);
                let key = buildStoreKey(Realm, StoreKeyCode, subid);
                delete localStorage[key];
                cnt++;
                notifyDone(subid, cnt);
            }

            $("#xDone").show();
        }
        catch (err) {
            log("ошибка удаления старых юнитов", err);
            $("#xFail").show();
            let e = err as Error;
            $("#lgProblem").append(e.message + " => " + e.stack);
            throw err;
        }
        finally {
            $parseBtn.prop("disabled", false);
        }
    });
    $vh.append($clearDeletedBtn);

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
            if (key !== buildStoreKey(Realm, StoreKeyCode, subid))
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

    // экспорт в CSV формат
    let $exportCsvBtn = $("<input type='button' id='vh_exportCsv' value='Export Csv'>");
    $exportCsvBtn.on("click", () => {
        exportCsv($header);
    });
    $vh.append($exportCsvBtn);

    $header.append($vh);

    // собираем всю информацию по магазинам включая рекламу и доходы
    async function parseVisitors_async() {
        try {
            // парсим список магов со страницы юнитов
            let p1 = await getShopsFuels_async();
            let subids = p1 as number[];
            log("shops", subids);

            // парсим профиты магов с отчета по подразделениям
            let p2 = await getProfits_async();
            let finance = p2 as IDictionaryN<IUnitFinance>;
            log("finance", finance);

            // число элементов должно совпадать иначе какой то косяк
            if (subids.length !== Object.keys(finance).length)
                throw new Error("Число юнитов с главной, не совпало с числом юнитов взятых с отчета по подразделениям. косяк.");

            notifyTotal(subids.length);

            // теперь для каждого мага надо собрать информацию по посетосам и бюджету
            // для полученного списка парсим инфу по посетителям, известности, рекламному бюджету
            // !!!!!! использовать forEach оказалось опасно. Так как там метод, он быстро выполнялся БЕЗ ожидания
            // завершения промисов и я получал данные когда то в будущем. Через циклы работает
            let parsedInfo: IDictionaryN<IVisitorsInfoEx> = {};
            let done = 0;
            for (let subid of subids) {
                // собираем данные по юниту и дополняем недостающим
                notifyCurrent(subid);
                let info = await getUnitInfo_async(subid);
                info.date = currentGameDate;
                info.income = finance[subid].income;    // если вдруг данных не будет все равно вывалит ошибку

                if (parsedInfo[subid])
                    throw new Error("юнита еще не должно быть в списке спарсеных " + subid);

                parsedInfo[subid] = info;
                done++;
                notifyDone(subid, done);
            }
            
            return parsedInfo;
        }
        catch (err) {
            log("Ошибка сбора посетителей.", err);
            throw err;
        }
    }

    function saveInfo(parsedInfo: IDictionaryN<IVisitorsInfoEx>) {
        // дата, старее которой все удалять нахуй
        let minDate = new Date(currentGameDate.getTime() - 1000 * 60 * 60 * 24 * 7 * KeepWeeks);
        log(`minDate == ${dateToShort(minDate)}`);

        for (let key in parsedInfo) {
            let subid = parseInt(key);
            let info = parsedInfo[subid];

            let storeKey = buildStoreKey(Realm, StoreKeyCode, subid);
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
            if (storedInfo[1][dateKey])
                log(`${subid}:${dateKey} существует. заменяем на`, compactInfo);

            storedInfo[1][dateKey] = compactInfo;

            // подчистим старые данные чтобы лог не захламлять
            let dates = Object.keys(storedInfo[1]).map(v => dateFromShort(v));
            dates.sort((a, b) => {
                if (a > b)
                    return 1;

                if (a < b)
                    return -1;

                return 0;
            });
            for (let d of dates) {
                if (d > minDate)
                    break;

                delete storedInfo[1][dateToShort(d)];
                log(`удалена запись для ${subid} с датой ${d}`);
            }


            localStorage[storeKey] = JSON.stringify(storedInfo);
        }
    }


    // собирает, число посетителей, сервис, известность, бюджет, население.
    async function getUnitInfo_async(subid: number): Promise<IVisitorsInfoEx> {
        try {
            // собираем странички
            let urlMain = `/${Realm}/main/unit/view/${subid}`;
            let urlAdv = `/${Realm}/main/unit/view/${subid}/virtasement`;
            let [htmlMain, htmlAdv] = await Promise.all([tryGet_async(urlMain), tryGet_async(urlAdv)]);
            //let htmlAdv = await tryGet_async(urlAdv);

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

    // получает список subid для всех наших магазинов и заправок
    async function getShopsFuels_async(): Promise<number[]> {

        // ставим фильтрацию на магазины, сбрасываем пагинацию.
        // парсим юниты, 
        // восстанавливаем пагинацию и фильтрацию
        try {
            // ставим фильтр в магазины и сбросим пагинацию
            await tryGet_async(`/${Realm}/main/common/util/setfiltering/dbunit/unitListWithProduction/class=1885/type=0/size=0`);
            await tryGet_async(`/${Realm}/main/common/util/setpaging/dbunit/unitListWithProduction/20000`);
            let htmlShops = await tryGet_async(`/${Realm}/main/company/view/${companyId}/unit_list`);

            // загрузим заправки
            await tryGet_async(`/${Realm}/main/common/util/setfiltering/dbunit/unitListWithProduction/class=422789/type=0/size=0`);
            let htmlFuels = await tryGet_async(`/${Realm}/main/company/view/${companyId}/unit_list`);

            // вернем пагинацию, и вернем назад установки фильтрации
            await tryGet_async(`/${Realm}/main/common/util/setpaging/dbunit/unitListWithProduction/400`);
            await tryGet_async($(".u-s").attr("href") || `/${Realm}/main/common/util/setfiltering/dbunit/unitListWithProduction/class=0/size=0/type=${$(".unittype").val()}`);

            // обработаем страничку и вернем результат
            let arr: number[] = [];

            let shops = parseUnitList(htmlShops, document.location.pathname);
            for (let key in shops) {
                if (shops[key].type !== UnitTypes.shop)
                    throw new Error("мы должны получить только магазины, а получили " + shops[key].type);

                arr.push(shops[key].subid);
            }

            let fuels = parseUnitList(htmlFuels, document.location.pathname);
            for (let key in fuels) {
                if (fuels[key].type !== UnitTypes.fuel)
                    throw new Error("мы должны получить только заправки, а получили " + fuels[key].type);

                arr.push(fuels[key].subid);
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
            let urlShops = `/${Realm}/main/company/view/${companyId}/finance_report/by_units/class:1885/`;
            let urlFuels = `/${Realm}/main/company/view/${companyId}/finance_report/by_units/class:422789/`;

            // сбросим пагинацию и заберем только отчет для магазинов и заправок. после чего вернем пагинацию
            await tryGet_async(`/${Realm}/main/common/util/setpaging/reportcompany/units/20000`);
            let htmlShops = await tryGet_async(urlShops);
            let htmlFuels = await tryGet_async(urlFuels);
            await tryGet_async(`/${Realm}/main/common/util/setpaging/reportcompany/units/400`);

            // обработаем полученную страничку
            let profitsShops = parseFinanceRepByUnits(htmlShops, urlShops);
            let profitsFuels = parseFinanceRepByUnits(htmlFuels, urlFuels);
            return mergeDictN(profitsShops, profitsFuels);
        }
        catch (err) {
            log("ошибка обработки отчета по подразделениям", err);
            throw err;
        }
    }


    // шляпа что рисуется сверху и показывает результаты
    function buildTable() {
        return `
        <div class='logger' style='font-size: 24px; color:gold; margin-bottom: 5px; margin-top: 15px;'>Process Log</div>
            <table id='lgTable' class='logger' style='font-size: 18px; color:gold; border-spacing: 10px 0; margin-bottom: 18px'>
                <tr>
                    <td>Units: </td>
                    <td id='lgDone'>0</td>
                    <td>of</td>
                    <td id='lgTotal'>0</td>
                    <td id='lgAllDone' style='display: none; color: lightgoldenrodyellow'>Done!</td>
                    <td id='lgCurrent' style='color: lightgoldenrodyellow'></td>
                </tr>
                <tr>
                    <td id='xDone' colspan=6 style='display: none; color: lightgoldenrodyellow'>All Done!</td>
                    <td id='xFail' colspan=6 style='display: none; color: lightgoldenrodyellow'>Failed!</td>
                </tr>
            </table>
            <div id='lgProblem' class='logger' style='color:red;'></div>
        </div>`;
    }

    function notifyTotal(shopCount: number) {
        $("#lgTotal").text(shopCount);
    }

    function notifyCurrent(subid: number) {
        $("#lgCurrent").text(subid);
    }

    function notifyDone(subid: number, count: number) {
        $("#lgDone").text(count);
    }
}

function unitMain() {
    if (!isShop(document) && !isFuel(document)) {
        log("не магазин и не заправка.");
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

    let storeKey = buildStoreKey(Realm, StoreKeyCode, subid);
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

function exportCsv($place: JQuery) {
    if ($place.length <= 0)
        return false;

    if ($place.find("#txtExport").length > 0) {
        $place.find("#txtExport").remove();
        return false;
    }

    let $txt = $('<textarea id="txtExport" style="display:block;width: 800px; height: 200px"></textarea>');



    // собираем все номера юнитов
    let subids: number[] = [];
    for (let key in localStorage) {
        // если в ключе нет числа, не брать его
        let m = extractIntPositive(key);
        if (m == null)
            continue;

        // если ключик не совпадает со старым ключем для посетителей
        let subid = m[0];
        if (key !== buildStoreKey(Realm, StoreKeyCode, subid))
            continue;

        subids.push(subid);
    }

    let exportStr = "subid;date;visitors;service;income;celebr;budget;pop" + "\n";

    // грузим данные по юниту, подгружаем размер города его имя
    for (let subid of subids) {
        let infoDict = loadInfo(subid);
        for (let dateKey in infoDict) {
            let item = infoDict[dateKey];
            let str = formatStr("{0};{1};{2};{3};{4};{5};{6};{7}", subid, dateKey, item.visitors, item.service, item.income, item.celebrity, item.budget, item.population);
            exportStr += str + "\n";
        }
    }

    $txt.text(exportStr);
    $place.append($txt);
    return true;
}

$(document).ready(() => Start());