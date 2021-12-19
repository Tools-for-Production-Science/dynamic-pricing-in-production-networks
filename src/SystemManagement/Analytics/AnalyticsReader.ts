/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { expDB } from "../expDB";
import { GenericExperimentStatus } from "../Configuration/GenericExperimentStatus";
import { Report } from "./Report";
import { VisualisationHelper } from "./VisualisationHelper"
import DateTime from 'datetime-js';
import MsgLog from "../MessengingSystem/MsgLog";
import { blacklist } from "../MessengingSystem/filter";
import Visualisation from "./Visualisation";
import DataStream from "./DataStream";

const { PerformanceObserver, performance } = require('perf_hooks');

interface env
{
    rep: Report,
    visid: number,
    type: "line" | "pie" | "bar" | "story" | "log"
}

export type chartType = "line" | "pie" | "bar" | "story" | "log";

export class AnalyticsReader
{

    expid: number;
    dbcon: expDB
    helper = new VisualisationHelper();

    /**
     * This class is used to read data from database from a parallel process
     * @param id of experiment
     * @param dbcon connector to database
     * @param historic wheather the experiment is historic
     */
    constructor(id: number, dbcon: expDB)
    {
        this.expid = id;
        this.dbcon = dbcon;

    }
    /**
     * 
     * @param repid id of report to get data from
     * @returns the report data as json object
     */
    getReport(repid): object
    {
        let sql = `SELECT * FROM ${this.dbcon.tableNames.reports} WHERE id = ${repid}`;
        let reps = this.dbcon.db.prepare(sql).get();

        sql = `SELECT DISTINCT * FROM ${this.dbcon.tableNames.vis} WHERE repid = ${repid}`

        let visCharts = this.dbcon.db.prepare(sql).all();
        if (visCharts.length > 0)
        {
            //let sets = new Array<any>();
            let visMap = new Map<number, Array<any>>();

            //const insert = this.dbcon.db.prepare('INSERT INTO baz VALUES ($foo, $bar)');
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
            //const getAll = this.dbcon.db.prepare(`SELECT label, data FROM ${this.dbcon.tableNames.reportData} WHERE visid = $visid`);
            let ar;
            data.forEach(element =>
            {
                ar = visMap.get(element["groupid"]);
                ar[0].push(element["label"]);
                ar[1].push(element["data"]);
            })

            //let data;
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
        return {};
    }
    
    getReports(): object
    {
        let res = new Array<object>();


        let sql = `SELECT * FROM ${this.dbcon.tableNames.reports} WHERE expid = ${this.expid};`;
        res = this.dbcon.db.prepare(sql).all()
        res.map(element =>
        {
            element["setTitle"] = element["name"];
            delete element["name"]
        })

        return [false, res];

    }
}