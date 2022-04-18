/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import EngineH1 from "../../../Environment/H1/EngineH1";
import { Analytics } from "../../Analytics/Analytics";
import Postprocessing from "../../Analytics/Postprocessing";
import { Environment } from "../../Configuration/EnvironmentEnum";
import MsgLog from "../../MessengingSystem/MsgLog";
import IExperiment from "../IExperiment";
import ExperimentTemplate from "./_ExperimentTemplate";

/**
 * This is a benchmark experiment for h1 environment. It automatically executes mutlitple runs, once with the ai and once without ai each, to compare the system performance 
 */
export default class ExperimentH1Benchmark extends ExperimentTemplate implements IExperiment
{
    async run()
    {
        let settings = this.settings;
        let seedArrayMatthiasH1: any = undefined;
        if (settings.envConfig.environment == Environment.BenchmarkH1MH)
        {
            seedArrayMatthiasH1 = this.settings.seedArrayH1;//= [121, 1304, 1835, 3561, 3596, 4421, 4955, 5397, 7071, 7578];//[3596, 4421, 4955, 5397, 7071, 7578];//[121, 1304, 1835, 3561, 3596, 4421, 4955, 5397, 7071, 7578];
            this.settings.envConfig.numberOfReplications = seedArrayMatthiasH1.length;
            if (seedArrayMatthiasH1.length < this.settings.envConfig.numberOfReplications)
                MsgLog.logError("Fehler: Number of Replications war größer als Seeds von Matthias", this, true, true);
        }

        let customerArray = this.settings.envConfig.customerArray;
        let trafficArray = this.settings.envConfig.trafficArray;
        let first = true;
        for (let i = 0; i < customerArray.length; i++)
        {
            this.settings.envConfig.customerAmount = customerArray[i]
            for (let j = 0; j < trafficArray.length; j++)
            {
                this.settings.envConfig.traffic = trafficArray[i]

                let numberReplications = this.settings.envConfig.numberOfReplications;

                for (let k = 0; k < numberReplications; k++)
                {
                    if (seedArrayMatthiasH1! != undefined)
                    {
                        this.settings.seed = seedArrayMatthiasH1[k]
                    }
                    this.settings.envConfig.useAI = true;
                    this.dbcon = await this.setupNewExperiment(settings);
                    this.expid = this.dbcon.expid;
                    this.analytics = new Analytics(this.expid, this.dbcon, false, settings.createLogReport, settings.maximumReportLength);

                    this.analytics.deactivateDataStreamWriterCreation = true;
                    this.analytics.writeLogsToDB = false;
                    this.analytics.deactivateReportsCreation = true;
                    this.settings.envConfig.scenario = 4; //only learning for total sim time
                    let tempTime = this.settings.envConfig.totalSimTime;
                    this.settings.envConfig.totalSimTime = 1400000;
                    let sim = new EngineH1(this.settings, this.analytics);
                    await sim.run();
                    let trained_model = sim.orchestrator!.getModelWeightsString();
                    this.settings.envConfig.totalSimTime = tempTime;

                    for (let s = 0; s < this.settings.envConfig.scenarioList.length; s++)
                    {

                        this.dbcon = await this.setupNewExperiment(settings);
                        this.expid = this.dbcon.expid;
                        this.analytics = new Analytics(this.expid, this.dbcon, false, settings.createLogReport, settings.maximumReportLength);

                        this.settings.envConfig.scenario = this.settings.envConfig.scenarioList[s];
                        await this.benchmarkingTestH1(true, trained_model)

                        this.dbcon = await this.setupNewExperiment(settings);
                        this.expid = this.dbcon.expid;
                        this.analytics = new Analytics(this.expid, this.dbcon, false, settings.createLogReport, settings.maximumReportLength);

                        await this.benchmarkingTestH1(false, trained_model)

                        if (seedArrayMatthiasH1! == undefined)
                            this.settings.seed = Math.round(this.engine!.randomSIM.random() * 100000000000000);
                    }
                }
            }
        }
    }

    async benchmarkingTestH1(useAI: boolean, trained_model: string)
    {
        this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.writeLogsToDB = false;
        this.analytics.deactivateReportsCreation = true;

        this.settings.envConfig.useAI = useAI;
        let sim = new EngineH1(this.settings, this.analytics);
        sim.orchestrator?.loadModelWeightsString(trained_model);

        this.analytics.deactivateDataStreamWriterCreation = false;
        this.analytics.deactivateReportsCreation = false;

        let custOrderWriter = this.analytics.createDataStreamWriter("CustomerOrders");
        sim.productionSystem.rep_custOrders_JSON = custOrderWriter;
        let prodOrderWriter = this.analytics.createDataStreamWriter("ProductionOrders");
        sim.productionSystem.rep_prodOrders_JSON = prodOrderWriter;

        this.dbcon.writeToDBCriterion = (() =>
        {
            return sim.sim.time() > (this.settings.envConfig.totalSimTime * this.settings.envConfig.startOfBenchmarkTest) + this.settings.envConfig.lengthSettlingPhase
        }).bind(this);

        this.engine = sim;

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
        this.reportFinished();
    }



}