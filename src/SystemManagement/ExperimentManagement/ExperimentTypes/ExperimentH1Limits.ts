/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { typeOf } from "mathjs";
import EngineH1 from "../../../Environment/H1/EngineH1";
import EngineH1Extension from "../../../Environment/H1/EngineH1Limit";
import { Analytics } from "../../Analytics/Analytics";
import Postprocessing from "../../Analytics/Postprocessing";
import IExperiment from "../IExperiment";
import ExperimentTemplate from "./_ExperimentTemplate";
var heapdump = require('heapdump');

/**
 * This is an experiment to find out general interrelationships depending on variable customer demand, machines and market movements.
 */
export default class ExperimentH1Limit extends ExperimentTemplate implements IExperiment
{
    counter = 0;
    async run()
    {
        /**
         * Es gibt 8 Kunden. Im H1 Case kann die Nachfrage über die Zwischenankunftszeit eingestellt werden
         * -> Ändere Zwischenankfuntszeit für verschiedene Demands 
         * Price und time sensitivity kann ebenfalls über Kunden eingestellt werden
         * 
         * Maschine (vorher muss auslastungstest durchgeführt werden):
         * 
         * in skillmap maschinen ergänzen. 
         */

        this.settings.envConfig.scenario = 5; // pretrained model, customer preferences are static

        //This list defines which machines should be removed or duplicated in a run. Removing prevents duplication. Duplication can only be done once, so right now it is not possible to e.g. duplicate id 7 twice to get three machines

        for (let m = 0; m <= 2; m++)
        { //machine round
            for (let d = 0; d <= 3; d++)
            {
                for (let p = -2; p <= 2; p++)
                {
                    if (this.counter >= this.settings.keyjump && this.counter <= this.settings.keyend)
                    {
                        let l = 0;
                        await this.runhelper(m, d, p / 10, l / 10);
                    }
                    this.counter++;
                }
                for (let l = -2; l <= 2; l++)
                {
                    if (this.counter >= this.settings.keyjump && this.counter <= this.settings.keyend)
                    {
                        let p = 0;
                        await this.runhelper(m, d, p / 10, l / 10);
                    }
                    this.counter++;
                }
            }
        }
    }

    async runhelper(m, d, p, l)
    {
        let machineModifierList = [{ rem: [9], add: [] }, { rem: [], add: [] }, { rem: [], add: [9] }];

        let additionalConfig = { key: this.counter, machineFactor: machineModifierList[m], demandFactor: 0.5 + d * 0.5, priceFactor: p, dueFactor: l }; //the key is to simplify data matching later in postprocessing
        this.settings.agentmodel = await this.trainModelAndReturn(1400000, additionalConfig); //1400000
        this.settings.name = "H1Limit_" + (new Date()).toLocaleString() + "_noAI" + "_m_" + m + "_d_" + d + "_p_" + p + "_l_" + l;
        await this.benchmarkingTestH1(true, additionalConfig);
        this.settings.name = "H1Limit_" + (new Date()).toLocaleString() + "_AI" + "_m_" + m + "_d_" + d + "_p_" + p + "_l_" + l;
        await this.benchmarkingTestH1(false, additionalConfig);
        this.settings.seed = Math.round(this.engine!.randomSIM.random() * 100000000000000);

        this.engine = null;
        this.dbcon = null!;
        this.analytics = null!;
    }


    /**
     * Trains an agent for a given time
     * @param simTime the time the agent should be trained
     * @returns the agent model
     */
    async trainModelAndReturn(simTime, additionalConfig)
    {
        let local_settings = JSON.parse(JSON.stringify(this.settings));
        local_settings.envConfig.useAI = true;


        this.dbcon = await this.setupNewExperiment(this.settings);
        this.analytics = new Analytics(this.expid, this.dbcon, false, local_settings.createLogReport, local_settings.maximumReportLength);

        this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.writeLogsToDB = false;
        this.analytics.deactivateReportsCreation = true;

        local_settings.envConfig.scenario = 4; //only learning for total sim time
        local_settings.envConfig.totalSimTime = simTime;

        let sim = new EngineH1Extension(local_settings, this.analytics, additionalConfig);
        await sim.run();
        return sim.orchestrator!.getModelWeightsString();
    }

    async benchmarkingTestH1(useAI: boolean, additionalConfig)
    {
        this.settings.envConfig.useAI = useAI;

        this.dbcon = await this.setupNewExperiment(this.settings);

        this.expid = this.dbcon.expid;
        this.analytics = new Analytics(this.expid, this.dbcon, false, this.settings.createLogReport, this.settings.maximumReportLength);

        this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.writeLogsToDB = false;
        this.analytics.deactivateReportsCreation = true;

        let sim = new EngineH1Extension(this.settings, this.analytics, additionalConfig);
        this.engine = sim;
        //sim.orchestrator?.loadModelWeightsString(trained_model); //check!! -> this should be done already because the model is loaded in the routine via the settings

        this.analytics.deactivateDataStreamWriterCreation = false;
        this.analytics.deactivateReportsCreation = false;

        let custOrderWriter = this.analytics.createDataStreamWriter("CustomerOrders");
        sim.productionSystem.rep_custOrders_JSON = custOrderWriter;
        let prodOrderWriter = this.analytics.createDataStreamWriter("ProductionOrders");
        sim.productionSystem.rep_prodOrders_JSON = prodOrderWriter;

        this.dbcon.writeToDBCriterion = (() => //memory leak
        {
            return (this as unknown as EngineH1Extension).sim.time() > ((this as unknown as EngineH1Extension).config.envConfig.totalSimTime * (this as unknown as EngineH1Extension).config.envConfig.startOfBenchmarkTest) + (this as unknown as EngineH1Extension).config.envConfig.lengthSettlingPhase
        }).bind(this.engine);

        this.dbcon.writeToDBCriterion = () => { return true; };

        await sim.run();

        let configurationBenchmarking = JSON.stringify(this.settings);
        this.dbcon.saveConfiguration(this.expid, configurationBenchmarking);

        let KPIs = new Postprocessing(this.analytics, this.expid, this.dbcon, this.engine).postProcessingH1Limit();

        let expResults = this.analytics.createNewReport("Auswertung des Experiments");
        let expResults_KPIs = this.analytics.createVisualisationWriter("Modus", "story", expResults);
        Object.keys(additionalConfig).forEach(key =>
        {
            if (typeof (additionalConfig[key.toString()]) === "object")
                expResults_KPIs.write(key, JSON.stringify(additionalConfig[key.toString()]));
            else
                expResults_KPIs.write(key, additionalConfig[key.toString()]);
        });

        expResults_KPIs = this.analytics.createVisualisationWriter("ProcessedKPIs", "story", expResults);
        Object.keys(KPIs).forEach(key =>
        {
            expResults_KPIs.write(key, KPIs[key.toString()]);
        });

        let machineRes = this.analytics.createVisualisationWriter("Nutzung", "story", expResults);
        sim.productionSystem.CapacityUsage_Data.forEach((val, key, map) =>
        {
            let mean = val.reduce((pr, cur, ind, ar) =>
            {
                return pr + cur;
            }) / val.length;

            let std = val.reduce((pr, cur, ind, ar) =>
            {
                return pr + Math.pow((cur - mean), 2);
            }) / (val.length - 1);

            machineRes.write(key, mean);
            machineRes.write(key, std);
        });


        let confStr = this.analytics.createVisualisationWriter("Konfiguration", "log", expResults);
        confStr.write("", JSON.stringify(this.settings));

        this.reportFinished();
    }



}