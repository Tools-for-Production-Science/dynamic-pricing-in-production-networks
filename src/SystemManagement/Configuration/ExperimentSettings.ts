/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { MLConfiguration } from "./MLConfiguration";
import { EnvironmentConfiguration } from "./EnvironmentConfiguration";

export class ExperimentSettings
{
    name: string;
    createLogReport = true; //Creates a Report with the logs!
    maximumReportLength = 500; //limits the reported data
    parallelProcessing = true;
    inMemoryCache = true; //speichere die Datenbank bis zum Ende des VErsuches auschließlich im Arbeitsspeicher
    seed = -1;
    seedArrayH1 = [121, 1304, 1835, 3561, 3596, 4421, 4955, 5397, 7071, 7578];
    constructor()
    {
        this.name = "Default";
    }

    envConfig = new EnvironmentConfiguration();
    //create new configuration object
    mlconfigL = new MLConfiguration();
    mlconfigN = new MLConfiguration();
    agentmodel: string = "";                                     //variables for saving the whole agent model weights


}