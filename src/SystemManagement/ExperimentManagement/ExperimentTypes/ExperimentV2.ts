/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { EngineV2 } from "../../../Environment/V2/EngineV2";
import Postprocessing from "../../Analytics/Postprocessing";
import IExperiment from "../IExperiment";
import ExperimentTemplate from "./_ExperimentTemplate";

/**
 * This is an experiment for the V2 environment. It can be used to examine a specific configuration/scenario
 */
export default class ExperimentV2 extends ExperimentTemplate implements IExperiment
{
   
    async run()
    {       
        
        this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.writeLogsToDB = false;
        this.analytics.deactivateReportsCreation = true;

        let sim = new EngineV2(this.settings, this.analytics);
        this.analytics.deactivateDataStreamWriterCreation = false;
        this.analytics.deactivateReportsCreation = false;
        let writer = this.analytics.createDataStreamWriter("KPIs");
        sim.productionSystem.rawKPIs = writer;
        this.dbcon.writeToDBCriterion = (() =>
        {
            return sim.sim.time() > (this.settings.envConfig.totalSimTime * this.settings.envConfig.startOfBenchmarkTest) + this.settings.envConfig.lengthSettlingPhase
        }).bind(this); 
        this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.deactivateReportsCreation = true;

        this.engine = sim;

        await sim.run();

        this.analytics.deactivateDataStreamWriterCreation = false;
        this.analytics.deactivateReportsCreation = false;
        let configurationBenchmarking = JSON.stringify(this.settings);
        this.dbcon.saveConfiguration(this.expid, configurationBenchmarking);
        new Postprocessing(this.analytics, this.expid, this.dbcon, sim).postprocessingV2();
        this.reportFinished();
    }
}