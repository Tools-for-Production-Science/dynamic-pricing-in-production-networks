/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { ExperimentSettings } from "../../Configuration/ExperimentSettings";
import { Environment } from "../../Configuration/EnvironmentEnum";
import IExperiment from "../IExperiment";
import { Experimentator } from "../Experimentator";
import ExperimentH1 from "../ExperimentTypes/ExperimentH1";
import ExperimentV2 from "../ExperimentTypes/ExperimentV2";
import ExperimentV2Optimization from "../ExperimentTypes/ExperimentV2Optimization";
import ExperimentH1Optimization from "../ExperimentTypes/ExperimentH1Optimization";
import ExperimentV2Benchmark from "../ExperimentTypes/ExperimentV2Benchmark";
import ExperimentH1Benchmark from "../ExperimentTypes/ExperimentH1Benchmark";
import ExperimentH1Limit from "../ExperimentTypes/ExperimentH1Limits";
import ExperimentH1Bottleneck from "../ExperimentTypes/ExperimentH1Bottleneck";

/**
 * This class handles the creation of distinct experiments
 */
export class ExperimentFactory
{
    /**
     * Creates a new experiment from settings
     * @param settings the settings controlling the experiment to setup
     * @param expid the id of the experiment
     * @param experimentator the experimentator class object
     * @param historic wheater the experiment is already done and only historic
     * @returns the experiment following the {@link IExperiment} interface
     */
    static createExerperiment(settings: ExperimentSettings, expid: number, experimentator: Experimentator | undefined, historic = false): IExperiment | undefined
    {
        let experiment;
        if (historic)
        {
            experiment = new ExperimentV2(settings, expid, experimentator, historic);
        }
        else
        {
            try
            {
                switch (settings.envConfig.environment)
                {
                    case Environment.v2:
                        {
                            experiment = new ExperimentV2(settings, expid, experimentator, historic);
                            break;
                        }
                    case Environment.h1:
                        {
                            experiment = new ExperimentH1(settings, expid, experimentator, historic);
                            break;
                        }
                    case Environment.V2OptMS:
                        {
                            experiment = new ExperimentV2Optimization(settings, expid, experimentator, historic);
                            break;
                        }
                    case Environment.H1OptMS:
                        {
                            experiment = new ExperimentH1Optimization(settings, expid, experimentator, historic);
                            break;
                        }
                    case Environment.BenchmarkMH:
                    case Environment.BenchmarkTest:
                        {
                            experiment = new ExperimentV2Benchmark(settings, expid, experimentator, historic);
                            break;
                        }
                    case Environment.BenchmarkH1MH:
                    case Environment.BenchmarkTestH1:
                        {
                            experiment = new ExperimentH1Benchmark(settings, expid, experimentator, historic);
                            break;
                        }
                    case Environment.BenchmarkH1Limit:
                        {
                            experiment = new ExperimentH1Limit(settings, expid, experimentator, historic);
                            break;
                        }
                    case Environment.ExperimentH1Bottleneck:
                        {
                            experiment = new ExperimentH1Bottleneck(settings, expid, experimentator, historic);
                            break;
                        }

                    default:
                        {
                            experiment = new ExperimentH1(settings, expid, experimentator, historic); //Create as a default to get access to visualization
                            throw "unsupported experiment or environment";
                        }
                }
            }

            catch (e: any)
            {
                console.log(e as Error);
                if (experiment == undefined)
                    experiment = new ExperimentV2(settings, expid, experimentator, historic);
                experiment.analytics.deactivateReportsCreation = false;
                experiment.analytics.deactivateDataStreamWriterCreation = false;
                let id = experiment.analytics.createNewReport("Fehlerbericht");
                let writer = experiment.analytics.createVisualisationWriter("Fehlermeldung", "log", id);
                writer.write('', e!.message);
                writer.write('', e!.stack);
                experiment.reportError();
                return undefined
            }
        }
        return experiment;
    }
}
