
/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import * as fs from 'fs';
import { ExperimentSettings } from './Configuration/ExperimentSettings';
import { Environment } from './Configuration/EnvironmentEnum';
import Paths from './Configuration/Paths';

import { Experimentator } from "./ExperimentManagement/Experimentator";
import IExperiment from './ExperimentManagement/IExperiment';
import { mergeDeep } from './HelperFunctions';
import { changeBlacklist } from './MessengingSystem/filter';



let fullTest = false;

let arg = process.argv[2];
if (arg == "fulltest")
{
    fullTest = true;
}


let FgRed = "\x1b[31m%s\x1b[0m"
let FgGreen = "\x1b[32m%s\x1b[0m"
let FgYellow = "\x1b[33m%s\x1b[0m"

function validityChecks(experiment: IExperiment)
{
    let trigger = true;
    //validity checks
    console.log(FgGreen, "Simulation finished successfully. Starting validity checks...");
    try
    {
        //File size
        console.log(FgGreen, "Checking database size as an indicator (must be bigger than 32kb)...");
        try
        {
            var stats = fs.statSync("./db/exp/" + experiment.expid + ".db")
            if (stats.size / (1024) > 33)
                console.log(FgGreen, "Size for db " + experiment.expid + ".db is okay with " + stats.size / 1024 + "KB!");
            else
            {
                console.log(FgRed, "File size too small - experiment most likely failed. Posting the settings...");
                console.log(FgRed, JSON.stringify(experiment.settings));
            }
        }
        catch {
            console.log(FgGreen, "Error: Couldnt read db " + experiment.expid + ".db!");
        }

    }
    catch (e)
    {
        console.log(FgRed, "Fehler: " + e, trigger = false);
    }
    if (trigger)
        console.log(FgGreen, "All tests passed successfully")
    else
        console.log(FgRed, "Some Tests failed");
}


function runTest()
{


    let expSett = new ExperimentSettings();

    try
    {
        let rawdata = fs.readFileSync(Paths.V2.testingConfig);
        let config = JSON.parse(rawdata as unknown as string);
        mergeDeep(expSett, config);
    }
    catch
    { }



    let blacklist =  //With this list it is possible to filter messages
        [
            "ProductionSystemV2",
            "EngineV2",
            "ProductionNetwork",
            "AgentV2",
            "Customer",
            "Function",
            "OrchestratorV2",
            "Environment",
            "DemandV2",
            "ProductionControlV2",
            "EngineH1",
            "ProuctionSystemH1"
        ];

    changeBlacklist(blacklist);

    let arrb = [true, true, true, true];
    try
    {
        if (fullTest)
        {
            let experimentator = new Experimentator(true);

            expSett.envConfig.totalSimTime = 15000;
            for (const mode in Environment)
            {
                for (let index = 0; index < 16; index++)
                {

                    let experiment: IExperiment;

                    arrb[0] = !arrb[0];
                    if (index % 2 == 0)
                        arrb[1] = !arrb[1];
                    if (index % 4 == 0)
                        arrb[2] = !arrb[2];
                    if (index % 8 == 0)
                        arrb[3] = !arrb[3];

                    let expSettSingle = new ExperimentSettings();
                    expSettSingle.envConfig.totalSimTime = 15000;


                    expSett.envConfig.useAI = arrb[0];
                    expSett.envConfig.dynamicLeadTime = arrb[1];

                    expSettSingle.parallelProcessing = arrb[2];
                    expSettSingle.inMemoryCache = arrb[3];

                    expSettSingle.envConfig.environment = mode as Environment;
                    experiment = experimentator.queueExperiment(expSett);
                    experiment.runningPromise.then(() =>
                    {
                        validityChecks(experiment);
                    })
                }
            }
        }
        else
        {
            let experiment: IExperiment;
            let experimentator = new Experimentator();
            expSett.parallelProcessing = true;
            expSett.inMemoryCache = true;
            expSett.envConfig.environment = Environment.h1;
            expSett.envConfig.useAI = true;

            experiment = experimentator.queueExperiment(expSett);
            experiment.runningPromise.then(() =>
            {
                validityChecks(experiment);
            })
        }
    }
    catch (ex)
    {
        console.log("Simulation Run failed: " + ex)
        return;
    }
}

runTest();