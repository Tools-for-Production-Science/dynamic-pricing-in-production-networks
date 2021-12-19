/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import sqlite4 from 'better-sqlite3';
import { GenericExperimentStatus } from './Configuration/GenericExperimentStatus';
import DateTime from 'datetime-js';
import fs from 'fs';

/**
 * The class for the general database management. This database only holds name, date and id of experiments. The data here is used to find the specific experiment database
 */
export class mgntDB
{
    db!: sqlite4.Database;
    dir = './db'; //location for the main database
    subDir = './db/exp'; //Each experiment gets its own database

    tableNames = {
        experiments: "experiments",
    };

    constructor()
    {
        this.setup();
    }
    /**
     * Delete a specific experiment id
     * @param id the experiment id
     */
    async removeId(id: any)
    {
        let sql = `
            DELETE FROM ${this.tableNames.experiments}
            WHERE expid = ${id}`;
        this.db.prepare(sql).run();

        fs.unlinkSync(`${this.subDir}/${id}.db`);
    }
    /**
     * Setup the database.
     */
    private setup()
    {

        //Create folders if they do not exist
        if (!fs.existsSync(this.dir))
        {
            fs.mkdirSync(this.dir);
        }

        if (!fs.existsSync(this.subDir))
        {
            fs.mkdirSync(this.subDir);
        }

        this.db = new sqlite4('./db/experiments.db');//, { verbose: console.log });

        //table for experiments is created
        let sql = `
        CREATE TABLE IF NOT EXISTS ${this.tableNames.experiments} ( 
          expid INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          date TEXT,
          end TEXT,
          status TEXT
          )`;
        this.db.prepare(sql).run();

        //Set all old experiments from last run to stoped because they were disrupted
        sql = `
        UPDATE ${this.tableNames.experiments}
        SET status = '${GenericExperimentStatus.stoped}'
        WHERE status = '${GenericExperimentStatus.running}' OR status = '${GenericExperimentStatus.paused}' OR status = '${GenericExperimentStatus.waiting}'`;
        this.db.prepare(sql).run();

    }
    /**
     * Create a new experiment
     * @param name Name of the experiment
     * @returns the id of the new experiment for later db requests
     */
    setupNewExperiment(name): number
    {
        let date = DateTime(new Date(), '%d.%m.%Y %H:%i:%s');

        let sql = `INSERT INTO ${this.tableNames.experiments} (name, date, end, status) VALUES('${name}', '${date}', '-', '${GenericExperimentStatus.waiting}');`;

        return (this.db.prepare(sql).run().lastInsertRowid as any) * 1;
    }
    /**
     * Set the status of the experiment
     * @param ExpID the id of the experiment
     * @param status the status from the generic list
     */
    setStatusExperiment(ExpID: number, status: GenericExperimentStatus)
    {
        let sql;
        if (status == GenericExperimentStatus.error || status == GenericExperimentStatus.finished || status == GenericExperimentStatus.stoped)
        {
            let date = DateTime(new Date(), '%d.%m.%Y %H:%i:%s');
            sql = `\
            UPDATE ${this.tableNames.experiments}\
            SET status = '${status}', end = '${date}'\
            WHERE expid = ${ExpID}`;
        }
        else
        {
            sql = `\
        UPDATE ${this.tableNames.experiments}\
        SET status = '${status}'\
        WHERE expid = ${ExpID}`;
        }
        this.db.prepare(sql).run();
    }
    /**
     * 
     * @returns An array of jsons of all experiments in the database
     */
    getExperiments()
    {
        let sql = `\
        SELECT * FROM ${this.tableNames.experiments}`;
        let res = this.db.prepare(sql).all();
        return res;
    }

    /**
     * Delete the database and create a new one
     */
    deleteAll()
    {
        /*let sql = "";
        Object.values(this.tableNames).forEach(element =>
        {
            sql = "DROP TABLE IF EXISTS " + element + ";";
            this.db.prepare(sql).run();
        });*/
        fs.readdirSync(this.subDir).forEach(element =>
        {
            fs.unlinkSync(`${this.subDir}/${element}`);
        });


        this.db.close();
        fs.unlinkSync('./db/experiments.db');

        this.db = new sqlite4('./db/experiments.db');//, { verbose: console.log });
        this.setup();
    }
}