/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import EngineH1 from "../../../Environment/H1/EngineH1";
import EngineH1Extension, { customConfig } from "../../../Environment/H1/EngineH1Limit";
import { Analytics } from "../../Analytics/Analytics";
import Postprocessing from "../../Analytics/Postprocessing";
import IExperiment from "../IExperiment";
import ExperimentTemplate from "./_ExperimentTemplate";

/**
 * This is an experiment to find out the trend depending on variable customer demand, machines and market movements
 */
export default class ExperimentH1Bottleneck extends ExperimentTemplate implements IExperiment
{
    async run()
    {
        this.settings.envConfig.scenario = 5; // pretrained model, customer preferences are static

        let additionalConfig: customConfig = { machineFactor: {rem:[], add:[]}, demandFactor: 1.5, priceFactor: 0, dueFactor: 0 };;
        await this.runTest(false, additionalConfig);
        this.settings.seed = Math.round(this.engine!.randomSIM.random() * 100000000000000);

    }

    first = true;
    async runTest(useAI: boolean, additionalConfig)
    {
        if (!this.first)
        {
            this.dbcon = await this.setupNewExperiment(this.settings);
        }
        this.first = false;

        this.expid = this.dbcon.expid;
        this.analytics = new Analytics(this.expid, this.dbcon, false, this.settings.createLogReport, this.settings.maximumReportLength);


        //this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.writeLogsToDB = false;
        //this.analytics.deactivateReportsCreation = true;

        this.settings.envConfig.useAI = useAI;
        let sim = new EngineH1Extension(this.settings, this.analytics, additionalConfig);
        this.engine = sim;

        // this.analytics.deactivateDataStreamWriterCreation = false;
        // this.analytics.deactivateReportsCreation = false;

        let custOrderWriter = this.analytics.createDataStreamWriter("CustomerOrders");
        sim.productionSystem.rep_custOrders_JSON = custOrderWriter;
        let prodOrderWriter = this.analytics.createDataStreamWriter("ProductionOrders");
        sim.productionSystem.rep_prodOrders_JSON = prodOrderWriter;

        this.dbcon.writeToDBCriterion = (() =>
        {
            return sim.sim.time() > (this.settings.envConfig.totalSimTime * this.settings.envConfig.startOfBenchmarkTest) + this.settings.envConfig.lengthSettlingPhase
        }).bind(this);

        await sim.run();

        let configurationBenchmarking = JSON.stringify(this.settings);
        this.dbcon.saveConfiguration(this.expid, configurationBenchmarking);

        let KPIs = new Postprocessing(this.analytics, this.expid, this.dbcon, this.engine!).postProcessingH1();

        let expResults = this.analytics.createNewReport("Auswertung des Experiments");
        let expResults_KPIs = this.analytics.createVisualisationWriter("ProcessedKPIs", "story", expResults);
        Object.keys(KPIs).forEach(key =>
        {
            expResults_KPIs.write(key, KPIs[key.toString()]);
        });

        let machineRes = this.analytics.createVisualisationWriter("Usage", "story", expResults);
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

        this.reportFinished();
    }



}