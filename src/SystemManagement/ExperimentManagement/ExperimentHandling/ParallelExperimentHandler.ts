/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { AnalyticsReader } from "../../Analytics/AnalyticsReader";
import { ExperimentSettings } from "../../Configuration/ExperimentSettings";
import IExperiment from "../IExperiment";
import * as child from 'child_process';
import { GenericExperimentStatus } from "../../Configuration/GenericExperimentStatus";
import { expDB } from "../../expDB";
import { mgntDB } from "../../mgntDB";
import { Experimentator } from "../Experimentator";
import { Environment } from "../../Configuration/EnvironmentEnum";

/**
 * This class handles parallel experiments by encapsulating a new thread an providing a standardized interfaces to the parallel thread.
 */
export class ParallelExperimentHandler
{
    analytics?: AnalyticsReader;
    expid: number;
    dbcon!: expDB;
    fork: child.ChildProcess | undefined = undefined;
    settings: ExperimentSettings;
    experimentator: Experimentator;
    runningPromise: Promise<boolean> = new Promise((res, rej) => { this.finish = res });
    setupPromise: Promise<boolean> = new Promise((res, rej) => { this.set = res });
    finish!: Function;
    set!: Function;
    private pathToFile = './built/SystemManagement/ExperimentManagement/ExperimentTypes/';

    /**
     * This class handles parallel experiments by encapsulating a new thread an providing a standardized interfaces to the parallel thread.
     * @param settings the settings for the experiment, see type
     * @param id the id of the experiment
     * @param experimentator the experimentator parent which created this object
     */
    constructor(settings: ExperimentSettings, id: number, experimentator: Experimentator)
    {
        this.experimentator = experimentator;
        this.expid = id;
        this.settings = settings;
    }

    /**
     * Neccessary routine to setup the experiment thread
     * @param productionMode 
     * @returns 
     */
    setup(productionMode = false)
    {
        this.fork = child.fork('./built/SystemManagement/ExperimentManagement/ExperimentHandling/ChildProcessExperiment.js')

        if (productionMode)
            this.fork.send(['prepareProduction', this.settings, this.expid]);
        else
            this.fork.send(['prepare', this.settings, this.expid]);

        this.fork.on('message', (msg) =>
        {
            switch (msg[0])
            {
                case "expid":
                    this.expid = msg[1];
                    this.dbcon = new expDB(this.expid, this.settings.inMemoryCache);
                    this.analytics = new AnalyticsReader(this.expid, this.dbcon);
                    this.set();
                    break;
                case "new":
                    this.dbcon.db.close();
                    this.expid = this.experimentator.switchToNewExpInSameRun(this.expid, this.settings)
                    this.fork?.send(['new', this.expid]);
                    break;
            }
        });

        this.fork.on('exit', (code) =>
        {
            if (code == 128)
                this.experimentator.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.error);
            else if (code == 129)
                this.experimentator.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.stoped);
            else
                this.experimentator.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.finished);

            if (this.settings.inMemoryCache)
            {
                this.dbcon = new expDB(this.expid, false);
                this.analytics = new AnalyticsReader(this.expid, this.dbcon);
            }
            this.finish();
        })

        return this.setupPromise;
    }
    /**
     * 
     * @returns promise which is awaitable. Is resolved when the experiment is finished anyway
     */
    run(): Promise<boolean>
    {
        if (this.fork == undefined || !this.fork.connected)
        {
            this.finish();
            return this.runningPromise;
        }

        this.fork.send(['start']);
        this.experimentator.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.running);
        return this.runningPromise;
    }
    /**
     * Pause the experiment run
     */
    pause()
    {
        if (this.fork?.connected)
        {
            this.fork?.send(['pause']);
            this.experimentator.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.paused);
        }
    }
    /**
     * Stop the experiment run. THe experiment can not be resumed afterwards
     * @returns 
     */
    stop()
    {
        if (this.fork?.connected)
        {
            this.fork?.send(['stop']);
            setTimeout(() =>
            {
                if (!this.fork?.killed && this.fork?.connected)
                {
                    this.fork?.kill();
                }
            }, 30000);
            this.dbcon.db.close();
            this.experimentator.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.stoped);
        }
        else
            return false;

        return true;
    }
    /**
     * continue the experiment after it was paused.
     */
    continue()
    {
        if (this.fork?.connected)
        {
            this.fork?.send(['continue']);
            this.experimentator.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.running);
        }
    }
    /**
     * Get a specific report from the experiment
     * @param repid the id of the report
     * @returns 
     */
    getReport(repid: number)
    {
        if (this.analytics != undefined)
            return this.analytics.getReport(repid);
    }
    /**
     * get a list of all experiments
     * @returns JSON object of alle reports
     */
    getReports()
    {
        if (this.analytics != undefined)
            return this.analytics.getReports();
    }
}