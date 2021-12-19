/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import IEngine from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IEngine";
import { Analytics } from "../../Analytics/Analytics";
import { ExperimentSettings } from "../../Configuration/ExperimentSettings";
import { GenericExperimentStatus } from "../../Configuration/GenericExperimentStatus";
import { expDB } from "../../expDB";
import { Experimentator } from "../Experimentator";
import { ExperimentFactory } from "../ExperimentHandling/ExperimentFactory";
import IExperiment from "../IExperiment";

export default abstract class ExperimentTemplate implements IExperiment
{
    engine: IEngine | null = null;
    analytics: Analytics;
    dbcon: expDB;



    //Only for automated Tests!
    finish!: Function;
    runningPromise: Promise<boolean> = new Promise((res, rej) => { this.finish = res });
    //

    interrupted = false;

    /**
     * This is an abstract template every experiment should inherit from. It handles the generic parts of an experiment
     * @param settings
     * @param expid 
     * @param experimentator 
     * @param historic //true if the experiment is already finsihed and only created to be able to display the data in the frontend 
     */
    constructor(public settings: ExperimentSettings, public expid: number, public experimentator: Experimentator | undefined, historic = false)
    {
        if (historic)
            this.dbcon = new expDB(expid, false);
        else
            this.dbcon = new expDB(expid, settings.inMemoryCache);
        this.expid = expid;
        this.analytics = new Analytics(this.expid, this.dbcon, historic); // generiere für jedes Experiment ein Analytics-Objekt
        if (!historic)
            this.dbcon.saveConfiguration(expid, JSON.stringify(settings))
    }
    /**
     * needs to be overwritten. Handles the experiment run
     */
    abstract run()

    /**
     * pause the experiment
     */
    pause()
    {
        if (this.engine != null)
        {
            this.engine.pause();
            if (!this.settings.parallelProcessing)
            {
                this.experimentator!.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.paused);
            }
        }
    }
    /**
     * Continue a paused experiment
     */
    continue()
    {
        if (this.engine != null)
        {
            this.engine.continue();
            if (!this.settings.parallelProcessing)
            {
                this.experimentator!.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.running);
            }
        }
    }
    /**
     * Stop an experiment
     */
    stop(): boolean
    {
        this.interrupted = true;
        let res = true;
        if (this.engine != null)
            this.engine.sim.stop();
        else
            res = false;

        if (!this.settings.parallelProcessing)
        {
            this.experimentator!.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.stoped);
        }
        this.analytics.finishAnalytics();
        if (this.settings.parallelProcessing)
        {
            this.dbcon.saveDBtoHDD();
            process.exit(129);
        }

        return res;
    }
    /**
     * Returns report data for speicifc report id
     * @param repid 
     * @returns 
     */
    getReport(repid: number)
    {
        return this.analytics.getReport(repid);
    }

    /**
     * Returns a list of all reports
     */
    getReports()
    {
        return this.analytics.getReports();
    }

    /**
     * handles the finishing of an experiment
     */
    reportFinished()
    {
        if (!this.interrupted)
        {
            this.analytics.finishAnalytics();
            if (!this.settings.parallelProcessing)
            {
                this.experimentator!.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.finished);
            }
            else
            {
                this.dbcon.saveDBtoHDD();
            }
        }
    }

    /**
     * Handles a caugfht exception 
     */
    reportError()
    {
        if (!this.interrupted)
        {
            this.analytics.finishAnalytics();
            if (!this.settings.parallelProcessing)
            {
                this.experimentator!.dbcon.setStatusExperiment(this.expid, GenericExperimentStatus.error);
            }
            else
            {
                this.dbcon.saveDBtoHDD();
                process.exit(128);
            }
        }
    }

    /**
     * Sets up a new epxeriment database
     * @param settings the experiment settings
     * @returns a reference to the database manager object
     */
    protected async setupNewExperiment(settings: ExperimentSettings)
    {
        let expid = await this.getNewExperimentId(settings);
        return new expDB(expid, this.settings.inMemoryCache);
    }

    switch!: Function;
    /**
     * Starts a routine (interprocess communication) to start a fresh experiment run
     * @param settings settings of the experiment
     * @returns a new experiment number
     */
    protected async getNewExperimentId(settings: ExperimentSettings): Promise<number>
    {
        if (this.settings.parallelProcessing)
        {
            process.send!(["new"],);
            let expid = await new Promise<number>((resolve) => { this.switch = resolve; });
            return expid;
        }
        else
            return this.experimentator!.switchToNewExpInSameRun(this.expid, settings);
    }

}