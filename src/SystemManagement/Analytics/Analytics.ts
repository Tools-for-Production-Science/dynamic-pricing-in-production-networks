/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { Report } from "./Report";
import { VisualisationHelper } from "./VisualisationHelper"
import MsgLog from "../MessengingSystem/MsgLog";
import { blacklist } from "../MessengingSystem/filter";
import Visualisation from "./Visualisation";
import DataStream from "./DataStream";
import { expDB } from "../expDB";

export type chartType = "line" | "pie" | "bar" | "story" | "log";

export class Analytics
{

    expid: number;
    dbcon: expDB;
    /**Frequency the buffered messages are written to the database. In the database there is an additional limit of messages. If the limit is reached messages are written, even if the timer have not been not activated*/
    updateFreq: number = 20000;

    //standardReportID: number = -1;
    /**Standard Report for logging */
    logReport: number = -1;
    /**Helper class to create visualisations*/
    helper = new VisualisationHelper();
    /**Map of all reports - is faster during runtime of erxperiment to use reports from here than from database.*/
    reports = new Map<number, Report>();
    /**Wheatehr console logs shalle be written to the database as well */
    writeLogsToDB: boolean;
    /**Datastream for the log messages */
    logStream!: DataStream;

    /**deavtivates the creation of any new reports or visuals*/
    deactivateReportsCreation: boolean = false;
    /**deactivate the creation of new Datastreams*/
    deactivateDataStreamWriterCreation: boolean = false;
    /**historic mode is only for getting data from finished experiments from the database*/
    historic: boolean = false

    private updater;
    private reportLimit: number | undefined = undefined;

    /**
     * Analytics handles the data management during the experiment. It manages datastreams, reports and visuals transforming datastreams into charts. 
     * @param id of experiment
     * @param dbcon connector to database
     * @param historic wheather the experiment ist already finsihed and only historic
     * @param writeLogsToDB wheater log messages shall be written to db as well
     * @param logLimit limit of datapoints per chart shown during the runtime (due to performance)
     */
    constructor(id: number, dbcon: expDB, historic: boolean = false, writeLogsToDB = false, logLimit: number | undefined = undefined)
    {
        this.reportLimit = logLimit;
        this.expid = id;
        this.dbcon = dbcon;
        this.historic = historic;
        this.writeLogsToDB = writeLogsToDB
        //load from history
        //this.updateDefaultReports(); //Holt sich für das Experiment alle vergangenen SimulationsIDs und die dazugehörenden Simulationsdaten, schreibt diese in chartdata, löscht alle vorangegangenen Reports auf der Reports-Map und kreiirt neue Reports basierend auf den chartdata und fügt neuen Report zur Liste der Reports hinzu        
        if (!historic)
        {
            MsgLog.analyticsHook = this.log.bind(this);
            this.updater = setInterval(this.dbcon.syncDataWithDB.bind(this.dbcon), this.updateFreq);
            if (!this.deactivateReportsCreation)
            {
                this.createStandardReports();
            }
        }
    }

    private createStandardReports()
    {
        if (this.writeLogsToDB)
        {
            this.logReport = this.createNewReport('Logs');
            let vis = this.createVisualisation('', "log", this.logReport);
            this.logStream = this.createDataStreamWriter("log");
            this.logStream.subscribeVisualisation(vis);
        }
    }
    /**
     * Get data for a specific report
     * @param repid id of report from the experiment
     * @returns JSON data
     */
    getReport(repid): object
    {

        if (!this.historic)
        {
            //populate reports from RAM variables
            let rep = this.reports.get(repid);
            if (rep)
            {
                let res = {
                    id: rep.id,
                    setTitle: rep.reportTitle,
                    sets: Array.from(rep.vis.values()).map((x, y, z) => { return x.chartObject })
                };
                return res;
            }
        }
        else
        {
            //populate report from db
            let sql = `SELECT * FROM ${this.dbcon.tableNames.reports} WHERE id = ${repid}`;
            let reps = this.dbcon.db.prepare(sql).get();
            sql = `SELECT DISTINCT * FROM ${this.dbcon.tableNames.vis} WHERE repid = ${repid}`
            let visCharts = this.dbcon.db.prepare(sql).all();
            if (visCharts.length > 0)
            {
                let visMap = new Map<number, Array<any>>();
                sql = `SELECT groupid, label, data FROM ${this.dbcon.tableNames.experimentData} WHERE groupid IN (`

                let sum;
                let lab;
                let dat;
                visCharts.forEach(element =>
                {
                    sql += (element["groupid"] + ", ");

                    sum = new Array();
                    lab = new Array();
                    dat = new Array();
                    sum.push(lab);
                    sum.push(dat);
                    visMap.set(element["groupid"], sum);
                })
                sql = sql.slice(0, sql.length - 2);
                sql += ");"
                let data = this.dbcon.db.prepare(sql).all();
                let ar;
                data.forEach(element =>
                {
                    ar = visMap.get(element["groupid"]);
                    ar[0].push(element["label"]);
                    ar[1].push(element["data"]);
                })


                let temp;
                let sets = new Array();
                visCharts.forEach(element =>
                {

                    temp = {
                        chartType: element["type"],
                        chartTitle: element["name"]
                    }
                    temp.chartData = this.helper.createChartDataObject(element["type"]);

                    temp.chartData["labels"] = visMap.get(element["groupid"])![0];
                    temp.chartData["datasets"][0]["data"] = visMap.get(element["groupid"])![1];
                    sets.push(temp);
                });


                let res = {
                    id: repid,
                    setTitle: reps["name"],
                    sets: sets
                };
                return res;
            }
        }
        return {};
    }
    /**
     * Get a list of alle reports as json data
     * @return JSON data
     */
    getReports(): object
    {
        let res = new Array<object>();


        if (!this.historic)
        {

            this.reports.forEach((value, key) =>
            {
                if (value.id != this.logReport)
                    res.push({ id: value.id, setTitle: value.reportTitle });
            });
        }
        else
        {
            let sql = `SELECT * FROM ${this.dbcon.tableNames.reports} WHERE expid = ${this.expid};`;
            res = this.dbcon.db.prepare(sql).all()
            res.map(element =>
            {
                element["setTitle"] = element["name"];
                delete element["name"]
            })
        }
        return [this.historic, res];
    }

    /**
     * create anew report
     * @returns id of the newly created report. The id can be used to allocate visuals on the report. 
     */
    createNewReport(name: string): number
    {
        if (this.deactivateReportsCreation)
            return -1;

        let repid = this.dbcon.setupNewReport(this.expid, name);

        let rep = new Report(name, repid)
        this.reports.set(repid, rep);

        return repid;
    }

    /**
     * This function creates a visualtion in a report and returns a callback which can be used to save data the visualization
     * @param title Title of Chart
     * @param type Charttype, currently only "line" is supportet
     * @param reportid optional; Id of report where chart should be created. When no id is given, the standard report is used
     * @returns Callback function taking label and data values. 
     */
    createVisualisation(title: string, type: chartType, reportid: number, groupid = -1): Visualisation
    {
        if (this.deactivateReportsCreation)
            return new Visualisation(-1, title, type, {}, 0)

        let visid = this.dbcon.setupNewVisualisation(reportid, type, title, groupid);
        let rep = this.reports.get(reportid);

        let chartDataObject = this.helper.createChartDataObject(type);

        let chartObject =
        {
            chartType: type,
            chartTitle: title,
            chartData: chartDataObject
        }
        let vis = new Visualisation(visid, title, type, chartObject, this.reportLimit)
        rep?.vis.set(vis.id, vis);
        return vis;
    }
    /**
     * Create a datastream where different data can be written to. The data will be saved in the database. The data must have the form (label, data).
     * @param name Name of the datastream
     * @param vis optional: the visualisation object which shall show the datastream in a chart
     * @returns the datatsream object
     */
    createDataStreamWriter(name: string, vis: Visualisation | undefined = undefined): DataStream
    {
        let temp = new DataStream(this.expid, name, this.dbcon, this.deactivateDataStreamWriterCreation);

        if (vis != undefined && !this.deactivateReportsCreation)
            temp.subscribeVisualisation(vis);

        return temp;
    }
    /**
     * This is a helper function to create a datastream and a visual showing the datastream in one step. 
     * @param title title of chart
     * @param type chart type, e.g. line, bar...
     * @param reportid the report id the visual shall be shown in
     * @returns a new datastream object
     */
    createVisualisationWriter(title: string, type: chartType, reportid: number): DataStream
    {
        //Improved speed of creation here by changing order
        let temp = this.createDataStreamWriter(title);
        let vis = this.createVisualisation(title, type, reportid, temp.groupid);
        temp.visualisations.push(vis);
        return temp;
    }

    /**
     * finish routine for the analytics. Stops the timer for writing data, synchronises buffered data with database so no data is lost. Deletes variables to free up RAM
     */
    finishAnalytics()
    {
        clearInterval(this.updater);
        MsgLog.analyticsHook = undefined;
        this.dbcon.syncDataWithDB(); //Final um alles offene zu übertragen
        this.historic = true;
        this.reports.clear(); //release RAM
    }

    ///Logging
    
    private logtypes = MsgLog.types;

    logDebug(msg, sender, showInConsole = true)
    {
        this.log(this.logtypes.debug, msg, sender, false, showInConsole)
    }

    logWarning(msg, sender, showInConsole = true)
    {
        this.log(this.logtypes.warning, msg, sender, false, showInConsole)
    }

    logError(msg, sender, throwError = true, showInConsole = true)
    {
        this.log(this.logtypes.error, msg, sender, throwError = true, showInConsole)
    }

    log(type, msg, sender, throwError = false, showInConsole = false)
    {
        let errStack = "";
        if (type == this.logtypes.error)
            errStack = "\n (" + ((new Error) as any).stack + ") ";

        let logString = "(" + this.logtypes[type] + ")@" + this.getCurrDate() + " von " + sender.constructor.name + errStack + ": " + msg;
        let filter = blacklist.some((el) => //New Filter function -> see filter.ts for the list of filtered classes
        {
            if (el == sender.constructor.name)
                return true;

            return false;
        });

        if (throwError || type == this.logtypes.error)
            filter = false;

        if ((showInConsole) && !filter) console.log(logString);


        if (this.writeLogsToDB)
            this.logStream.write('', logString, false)

        if (throwError)
        {
            throw new Error(msg);
        }
    }

    /**Helper function to get a timestamp string*/
    private getCurrDate()
    {
        var objToday = new Date(),
            weekday = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
            dayOfWeek = weekday[objToday.getDay()],
            //domEnder = function () { var a:any = objToday; if (/1/.test(parseInt((a+"").charAt(0))+"")) return "th"; a = parseInt((a + "").charAt(1)); return 1 == a ? "st" : 2 == a ? "nd" : 3 == a ? "rd" : "th" }(),
            dayOfMonth = today + (objToday.getDate() < 10) ? '0' + objToday.getDate() : objToday.getDate(),
            //months = new Array('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'),
            curMonth = objToday.getMonth() + 1,
            curYear = objToday.getFullYear(),
            curHour = objToday.getHours() < 10 ? "0" + objToday.getHours() : objToday.getHours(),
            curMinute = objToday.getMinutes() < 10 ? "0" + objToday.getMinutes() : objToday.getMinutes(),
            curSeconds = objToday.getSeconds() < 10 ? "0" + objToday.getSeconds() : objToday.getSeconds(),
            curMSecs = objToday.getMilliseconds(),
            curMeridiem = objToday.getHours() > 12 ? "PM" : "AM";
        var today = dayOfMonth + "." + curMonth + "." + curYear + " " + curHour + ":" + curMinute + ":" + curSeconds + "." + curMSecs;

        return today;
    }

}