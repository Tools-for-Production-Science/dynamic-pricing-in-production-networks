/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import sqlite4, { Statement, Transaction } from 'better-sqlite3';
import DateTime from 'datetime-js';
import { ExperimentDataTypes } from './Configuration/ExperimentDataTypes';
import fs from 'fs';

/**
 * This class is the database management for one experiment. Each experiment has its own database to avoid concurrent access problems inherent to sqlite3.
 */
export class expDB
{
    db: sqlite4.Database;
    writeToDBCriterion: () => boolean = () => true; //With this function database writing can be controlled centrally. If the function returns false the data is droped

    subDir = './db/exp';
    expid: number; //the experiment number
    private inMemory; //this flag controls if the database should be created in RAM; this can vastly improve speed

    tableNames = {
        simulations: "simulations",
        logs: "logs",
        reports: "reports",
        vis: "visualisations",
        confData: "confdata",
        experimentData: "experimentData",
        experimentDataGroup: "experimentDataGroup"
    };
    /**
     * Create a new experiment database
     * @param expid the id of the experiment; WARNING: If the experiment id already exists it reueses the database which can lead to problems
     * @param inMemory wheather the database should be created only in RAM
     */
    constructor(expid: number, inMemory = true)
    {
        this.inMemory = inMemory;
        this.expid = expid;


        if (inMemory)
        {
            this.db = new sqlite4(`:memory:`);//, { verbose: console.log });
        }
        else
            this.db = new sqlite4(`${this.subDir}/${expid}.db`);//, { verbose: console.log });

        this.configure();
    }

    saveDBtoHDD()
    {
        if (this.inMemory)
        {
            const buffer = this.db.serialize();
            fs.writeFileSync("" + this.subDir + "/" + this.expid + ".db", buffer);
        }
    }

    configure()
    {

        /**
        * Table for configuration and model data; Other data types can still be included.
         * It should only be data that occurs once by type. So there is only one instance!
         * Although it is theoretically possible to save several of the same type -> for later, if
         * times types of gradients have to be saved    
        */
        let sql = `
        CREATE TABLE IF NOT EXISTS ${this.tableNames.confData} ( 
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expid INTEGER,
          type INTEGER,
          data TEXT,
          date TEXT
          )`;
        this.db.prepare(sql).run();

        sql = `
        CREATE TABLE IF NOT EXISTS ${this.tableNames.reports} ( 
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expid INTEGER,
          name TEXT
          )`;
        this.db.prepare(sql).run();

        sql = `
        CREATE TABLE IF NOT EXISTS ${this.tableNames.vis} ( 
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repid INTEGER,
          type TEXT,
          name TEXT,
          groupid Integer
          )`;
        this.db.prepare(sql).run();

        //Table for logs
        sql = `
          CREATE TABLE IF NOT EXISTS ${this.tableNames.logs} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expid INTEGER,
            msg TEXT
            )`;

        this.db.prepare(sql).run();

        sql = `
        CREATE TABLE IF NOT EXISTS ${this.tableNames.experimentData} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          groupid INTEGER,
          expid INTEGER,
          date TEXT,        
          label TEXT,
          data TEXT
          )`;


        this.db.prepare(sql).run();

        sql = `
        CREATE TABLE IF NOT EXISTS ${this.tableNames.experimentDataGroup} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expid INTEGER,
          name TEXT
          )`;


        this.db.prepare(sql).run();

        this.setupFastWriteExperimentData();
        this.prepareVisCreator();
        this.prepareVisFastSubscriber();
    }

    /**
     * Creates a new datagroupd. A data group helps to organize data entries in the form (label, data)
     * @param expid the id of the experiment
     * @param name the name of the group. The name is only for human readbility when debugging the database as it is not used for any logic in this software
     * @returns the id of the data group
     */
    setupNewRawDataGroup(expid, name): number
    {
        let sql = `INSERT INTO ${this.tableNames.experimentDataGroup} VALUES(NULL, ${expid}, '${name}');`;

        return (this.db.prepare(sql).run().lastInsertRowid as any) * 1;
    }
    /**
     * Sets up a new report. A report is like a chapter holding multiple charts, statistics and so on. A report organizes/groups these kind of visuals
     * @param expid the experiment id the report is linked to
     * @param name the name of the report (will be shown in frontend)
     * @returns the id of the report
     */
    setupNewReport(expid: number, name: string)
    {
        let sql = `INSERT INTO ${this.tableNames.reports} (expid, name) VALUES('${expid}','${name}');`;
        return (this.db.prepare(sql).run().lastInsertRowid as any) * 1;
    }

    /**
     * This creates a prepared collector for the visuals. It is implemented to improve performance
     */
    private visStatement!: Statement;
    private prepareVisCreator()
    {
        let sql = `INSERT INTO ${this.tableNames.vis} VALUES(NULL, $repid, $type, $title, $groupid);`;
        this.visStatement = this.db.prepare(sql);
    }
    /**
     * Create a new visual for the frontend
     * @param repid The report the visual should be shown in
     * @param type The visual type e.g. line chart, bar chart, table,....
     * @param title Titel of the visual
     * @param groupid the data group holding the data to show 
     * @returns 
     */
    setupNewVisualisation(repid: number, type: string, title: string, groupid: number = -1)
    {
        return (this.visStatement.run({
            repid: repid,
            type: type,
            title: title,
            groupid: groupid
        }).lastInsertRowid as any) * 1;
    }

    /**
     * Save the agent model
     * @param expId the experiment id
     * @param actorJSON the agent mpdl as json string
     * @returns 
     */
    saveAgent(expId: number, actorJSON: string)
    {
        let date = DateTime(new Date(), '%d.%m.%Y %H:%i:%s');
        //Delete old values first 
        let sql = `
        DELETE FROM ${this.tableNames.confData}
        WHERE expid = ${expId} AND type = '${ExperimentDataTypes.agentmodel}';`;
        this.db.prepare(sql).run();

        sql = `
        INSERT INTO ${this.tableNames.confData}
        VALUES(NULL, ${expId}, '${ExperimentDataTypes.agentmodel}', '${actorJSON}', '${date}');`;
        return this.db.prepare(sql).run();
    }
    /**
     * Save the configuration of the experiment in the database. Per experiment there can be only one entry at the moment
     * @param expId the id of the experiment
     * @param configStr the config as a json string
     */
    saveConfiguration(expId: number, configStr: string)
    {
        let date = DateTime(new Date(), '%d.%m.%Y %H:%i:%s');

        //Delete old values first 
        let sql = `
        DELETE FROM ${this.tableNames.confData}
        WHERE expid = ${expId} AND type = '${ExperimentDataTypes.configuration}';`;
        this.db.prepare(sql).run();

        sql = `
        INSERT INTO ${this.tableNames.confData}
        VALUES(NULL, ${expId}, '${ExperimentDataTypes.configuration}', '${configStr}', '${date}');`;
        this.db.prepare(sql).run();
    }
    /**
     * get the configuration from an experiment
     * @param expId the experiment id
     * @returns the configuration as a json object
     */
    getConfigurationAndAgent(expId: number): object
    {

        let sql = `\
        SELECT * FROM ${this.tableNames.confData} WHERE expid = ${expId} AND type = '${ExperimentDataTypes.configuration}'  LIMIT 1;`;
        let conf = this.db.prepare(sql).all();

        sql = `\
        SELECT * FROM ${this.tableNames.confData} WHERE expid = ${expId} AND type = '${ExperimentDataTypes.agentmodel}'  LIMIT 1;`;
        let agent = this.db.prepare(sql).all();

        let confObj = {};

        try
        {
            confObj = JSON.parse(conf[0]["data"]);
            confObj["agentmodel"] = JSON.parse(agent[0]["data"]);
        }
        catch { }



        return confObj;
    }

    /**
     * this block is also for improving writing speed of data
     */
    private transactionWriter!: Transaction;
    private fastWriter!: Statement;
    private statements = new Array<any>();
    private debug = false;
    private setupFastWriteExperimentData()
    {
        let sql = `
        INSERT INTO ${this.tableNames.experimentData}
        VALUES(NULL, $groupid, $expid, $date, $label, $data);`;
        this.fastWriter = this.db.prepare(sql);

        this.transactionWriter = this.db.transaction((data) =>
        {
            for (let obj of data) 
            {
                if (this.debug)
                    console.log(obj);

                this.fastWriter!.run(obj);
            }
        });
    }
    /**
     * Write data
     * @param groupid the group id for the data stream to write to
     * @param expId the experiment id
     * @param label the label of the entry (x axis for charts)
     * @param data the data of the entry (y axis for charts)
     * @param direct write the data directly to the database, no buffering; not recommended; default is false
     */
    writeExperimentData(groupid: number, expId: number, label: any, data: any, direct = false)
    {
        if (!this.writeToDBCriterion())
            return;

        let date = DateTime(new Date(), '%d.%m.%Y %H:%i:%s');
        if (direct)
        {
            this.fastWriter!.run({
                groupid: groupid,
                expid: expId,
                date: date,
                label: label,
                data: data
            });
        }
        else
        {

            this.statements.push(
                {
                    groupid: groupid,
                    expid: expId,
                    date: date,
                    label: label,
                    data: data
                });
            //If statements list is getting to long, write to db even if timer did not switch to zero yet
            if (this.statements.length > 10000)
                this.syncDataWithDB();
        }
    }

    /**
     * Execute all open statments; is called periodically and should be called in the end to prevent data loss
     */
    syncDataWithDB()
    {
        if (this.statements.length == 0)
            return;

        this.transactionWriter(this.statements);
        this.statements.length = 0;
        /*
        
        */
    }

    /**
     * improve writing speed
     */
    private fastSubscriber!: Statement;
    private prepareVisFastSubscriber()
    {
        let sql = `
        UPDATE ${this.tableNames.vis}
        SET groupid = $groupid
        WHERE id = $id;`;
        this.fastSubscriber = this.db.prepare(sql);
    }
    /**
     * Subscribe a visual to a datastream to show its data
     * @param id id of visual
     * @param groupid groupid to subscribe to
     */
    subscribeVis(id: number, groupid: number)
    {
        this.fastSubscriber.run({
            groupid: groupid,
            id: id
        });
    }


    /**
     * returns all data from a data group
     * @param groupid 
     * @returns the data from the datastream as an array of json
     */
    getExperimentData(groupid: number)
    {
        let sql = `
        SELECT * FROM ${this.tableNames.experimentData} WHERE groupid = ${groupid}`;
        return this.db.prepare(sql).all();
    }

    /**
     * Special function for getting the reward of actor directly proccessed
     * @param expID 
     * @param groupid 
     * @returns 
     */
    getRewardFromExperiment(expID: number, groupid: number): number[]
    {
        let sumReward = Number.POSITIVE_INFINITY;

        let sql = `\
            SELECT * FROM ${this.tableNames.experimentData} WHERE expid = ${expID} AND groupid = ${groupid} AND label = 'RawReward'; `

        let resReward = this.db.prepare(sql).all();
        let lengthReward = 0;

        try
        {
            let resActorLossArray = resReward.map((val) => { return val["data"] * 1; });
            let sumActorLoss = resActorLossArray.reduce((a, b) => { return a + b; })

            sumReward = sumActorLoss;
            lengthReward = resReward.length

        }

        catch
        {

        }

        return [sumReward, lengthReward];
    }
}