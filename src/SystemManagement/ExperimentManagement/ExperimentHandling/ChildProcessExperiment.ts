/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import IExperiment from "../IExperiment";
import { ExperimentFactory } from "./ExperimentFactory";

let exp: IExperiment;

/**
 * This is a handler for interprocess communication
 */
process.on('message', (msg: Array<any>) =>
{
    let temp;
    switch (msg[0])
    {
        case 'prepare':
            temp = ExperimentFactory.createExerperiment(msg[1], msg[2], undefined);
            if (temp != undefined)
            {
                exp = temp;
                process.send!(["expid", exp.expid]);
            }
            break;
        case 'prepareProduction':
            console.log = () => { };
            temp = ExperimentFactory.createExerperiment(msg[1], msg[2], undefined);            
            if (temp != undefined)
            {
                exp = temp;
                exp.engine?.orchestrator.enableProdMode();
                process.send!(["expid", exp.expid]);
            }
            break;
        case 'start':
            exp.run().then(() =>
            {
                process.exit();
            });
            break;
        case 'pause':
            exp.pause();
            break;
        case 'stop':
            exp.stop();
            process.exit();
            break;
        case 'continue':
            exp.continue();
            break;
        case 'new':
            exp.switch(msg[1]);
            break;
    }
});


/**
 * This functions tries to save the inmemory database in case of errors
 */
let exitHandler = () =>
{
    if (exp != undefined)
        if (exp.settings.parallelProcessing && exp.settings.inMemoryCache)
            exp.dbcon.saveDBtoHDD();

    if ((this as unknown as any).status)
        process.exit((this as unknown as any).status);
    else
        process.exit()
}

//do something when app is closing
process.on('exit', exitHandler);

//catches ctrl+c event
process.on('SIGINT', exitHandler);

// catches "kill pid"
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind({ status: 128 }));