/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import EngineH1 from "../../../Environment/H1/EngineH1";
import Postprocessing from "../../Analytics/Postprocessing";
import IExperiment from "../IExperiment";
import ExperimentTemplate from "./_ExperimentTemplate";

/**
 * This is an experiment for the h1 environment. It can be used to examine a specific configuration/scenario
 */
export default class ExperimentH1 extends ExperimentTemplate implements IExperiment
{
    
    async run()
    {
        let settings = this.settings;
        let simulation = new EngineH1(settings, this.analytics); 
        this.engine = simulation;


        let custOrderWriter = this.analytics.createDataStreamWriter("CustomerOrders");
        simulation.productionSystem.rep_custOrders_JSON = custOrderWriter;
        let prodOrderWriter = this.analytics.createDataStreamWriter("ProductionOrders");
        simulation.productionSystem.rep_prodOrders_JSON = prodOrderWriter;


        await simulation.run();
        this.reportFinished();

        let configurationBenchmarking = JSON.stringify(this.settings);

        this.dbcon.saveConfiguration(this.expid, configurationBenchmarking);

        let KPIs = new Postprocessing(this.analytics, this.expid, this.dbcon, this.engine).postProcessingH1();

        let expResults = this.analytics.createNewReport("Auswertung des Experiments");
        let expResults_KPIs = this.analytics.createVisualisationWriter("KPIs", "story", expResults);
        Object.keys(KPIs).forEach(key =>
        {
            expResults_KPIs.write(key, KPIs[key.toString()]);
        });
        expResults_KPIs.write("OutputProducts", simulation.productionSystem.counterOutputProducts);
        expResults_KPIs.write("OutputTraffic", simulation.productionSystem.counterTrafficProducts);
        expResults_KPIs.write("overallGeneratedRevenueFromProdSysCounter", simulation.productionSystem.overallRevenue);
        this.reportFinished();
    }

}