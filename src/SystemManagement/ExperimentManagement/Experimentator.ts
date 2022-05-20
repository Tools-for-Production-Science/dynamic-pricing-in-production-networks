/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { mgntDB } from "../mgntDB";
import { ExperimentSettings } from "../Configuration/ExperimentSettings";
import MsgLog from "../MessengingSystem/MsgLog";
import TrueRandom from "./TrueRandom";
import * as child from 'child_process';
import { blacklist } from "../MessengingSystem/filter";
import { ParallelExperimentHandler } from "./ExperimentHandling/ParallelExperimentHandler";
import os from "os";
import { GenericExperimentStatus } from "../Configuration/GenericExperimentStatus";
import IExperiment from "./IExperiment";
import { ExperimentFactory } from "./ExperimentHandling/ExperimentFactory";
/**
 * this class is the entry point for the simulation. It receives control input to start, pause, continue and stop experiments. 
 */
export class Experimentator
{
    dbcon: mgntDB;
    experiments = new Map<number, IExperiment>();
    queue = new Array<IExperiment>();
    parallelQueue = new Array<ParallelExperimentHandler>();
    availableCPUCores = os.cpus().length;
    parallelRunning = new Array<ParallelExperimentHandler>();
    private productionMode = false;
    /**
     * 
     * @param productionMode wheather production mode is used. Only relevant for parallel processing to stop console logs there. 
     */
    constructor(productionMode = false)
    {
        this.productionMode = productionMode;
        console.log("the blacklist in filter.ts prevents the following classes to log messages: ");
        blacklist.forEach((el) => console.log(el));

        this.dbcon = new mgntDB();
        MsgLog.dbConnector = this.dbcon;

        /**
         * Load finished experiments from database in order to show them in the frontend
         */
        let history = this.dbcon.getExperiments();
        history.forEach(element =>
        {
            let exp = ExperimentFactory.createExerperiment(element["name"], element["expid"], this, true)
            this.experiments.set(element["expid"], exp!);
        });
    }

    /**
     * queue a new experiment to be run as soon as possible. For synchronous experiment, each will be run one by one. For parallel experiments there will be as many in parallel as there are threads on the pc. The thread number is calculated automatically
     * @param settings the settings to configure the experiment
     */
    queueExperiment(settings: ExperimentSettings) 
    {
        let exp;
        let id = this.dbcon.setupNewExperiment(settings.name);
        if (settings.parallelProcessing)
            exp = new ParallelExperimentHandler(settings, id, this);
        else
            exp = ExperimentFactory.createExerperiment(settings, id, this);
            
        this.experiments.set(exp.expid, exp); //Experiment wird mit seiner ExperimentID in der Experiments-Map gespeichert                            

        let runner = () =>
        {
            if (settings.parallelProcessing)
            {
                this.parallelQueue.push(exp);
                this.runParallelExperiment();
            }
            else
            {
                this.queue.push(exp);
                if (this.queue.length == 1)
                    this.runExperiment();
            }
        }

        if (settings.seed == -1) //no explicit seed was given
            TrueRandom.getSeed().then((seed) => //The True Random class provides a unique seed from a randomness server using cosmic radiation als basis
            {
                settings.seed = (settings.seed == -1) ? seed : settings.seed; //wenn seed nicht explizit initialisiert wurde, nutze den Random Seed
                if (typeof (seed) !== 'number' || Math.ceil(seed) != Math.floor(seed))
                {
                    MsgLog.logError("Seed Error! Seed: " + seed, this, true);
                }
                runner();
            });
        else
            runner();

        return exp;
    }

    /**
     * Run the next synchronous experiment from queue.
     */
    private async runExperiment()
    {
        if (this.queue.length > 0)
        {
            let exp = this.queue[0];
            if (exp)
            {
                // if (this.productionMode)
                //     exp.engine!.orchestrator!.enableProdMode();
                    
                exp.run().then(() =>
                {
                    MsgLog.log(MsgLog.types.debug, "Done simulating!", this);
                    exp.finish();
                    this.queue.shift();
                    this.runExperiment();
                    //this.experiments.delete(exp.expid)

                });
            }
        }
    }
    /**
     * Execute the next parallel experiment from the queue
     */
    private runParallelExperiment()
    {
        if (this.parallelRunning.length < this.availableCPUCores && this.parallelQueue.length > 0)
        {
            let exp = this.parallelQueue.shift()!;
            this.parallelRunning.push(exp);
            exp.setup(this.productionMode).then(() =>
            {
                exp.run().then(() =>
                {
                    let index = this.parallelRunning.indexOf(exp);
                    if (index > -1)
                    {
                        this.parallelRunning.splice(index, 1);
                    }
                    this.runParallelExperiment();
                })
            });


        }
    }
    /**
     * This is a helper function to create a new experiment in one run.
     * @param expid the experiment id of the finsihed experiment
     * @param settings the settings of the new experiment
     * @returns the experiment id of the new experiment
     */
    switchToNewExpInSameRun(expid: number, settings: ExperimentSettings): number
    {
        this.dbcon.setStatusExperiment(expid, GenericExperimentStatus.finished);
        let exp = ExperimentFactory.createExerperiment(settings, expid, this, true);
        let old = this.experiments.get(expid)!;
        this.experiments.set(expid, exp!);
        expid = this.dbcon.setupNewExperiment(settings.name);
        this.dbcon.setStatusExperiment(expid, GenericExperimentStatus.running);
        this.experiments.set(expid, old);
        return expid;
    }

    /**
     * pause the experiment
     * @param id id of the experiment
     * @returns 
     */
    pause(id: number): boolean
    {
        try
        {
            this.experiments.get(id)?.pause();
            return true;
        }
        catch
        {
            return false;
        }
    }
    /**
     * Continue a paused experiment
     * @param id of the experiment
     * @returns 
     */
    continue(id: number)
    {
        try
        {
            this.experiments.get(id)?.continue();
            return true;
        }
        catch
        {
            return false;
        }
    }
    /**
     * Stop the experiment. WARNING: after it is stoped, the experiment cannot be resumed. Consider pause.
     * @param id of the experiment
     * @returns 
     */
    stop(id: number)
    {
        try
        {
            if (!this.experiments.get(id)?.stop()) //Wenn das Experiment noch nicht gestartet wurde, gibt stop false zurück
            {
                this.queue.find((val, index, obj) =>
                {
                    if (val.expid == id)
                    {
                        this.queue.splice(index, 1);
                        return true;
                    }
                })
            }
            return;
        }
        catch
        {
            return false;
        }
    }

    /**
     * Get all reports from an experiment
     * @param expid of the experiment
     * @returns JSON object with all reports
     */
    getReports(expid: number)
    {
        return this.experiments.get(expid)?.getReports();
    }
    /**
     * Get data from a specific report
     * @param data JSON object defining the experiment id and the report id
     * @returns the data from the report as a JSON object
     */
    getReport(data: { expid: number, repid: number })
    {
        return this.experiments.get(data.expid)?.getReport(data.repid);

    }
    /**
     * Delete an experiment with all data from the filesystem and database
     * @param id of the epxeriment
     * @returns 
     */
    removeId(id: number)
    {
        try
        {
            if (this.experiments.get(id))
            {
                this.experiments.get(id)?.stop();
                this.experiments.get(id)?.dbcon.db.close();
            }

            this.dbcon.removeId(id);
            this.experiments.delete(id);
        }
        catch
        { return false; }

        return true;
    }
    /**
     * Delete all data and reset the database to a fresh new state
     * @returns 
     */
    deleteAll()
    {

        this.experiments.forEach((val, key) =>
        {
            try
            {
                val.stop();
            }
            catch { }
            try
            {
                val.dbcon.db.close();
            }
            catch { }
        });
        this.experiments.clear();
        try
        {
            this.dbcon.deleteAll();
        }
        catch
        { return false; }

        return true;
    }
    /**
     * Get the configuration and (current) ki model from an experiment
     * @param expid of the experiment
     * @returns JSON object of the configuration and ki model
     */
    getConfigurationAndAgent(expid: number)
    {
        return this.experiments.get(expid)!.dbcon.getConfigurationAndAgent(expid);
    }
}