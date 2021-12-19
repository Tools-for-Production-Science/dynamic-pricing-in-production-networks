/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import MsgLog from "../MessengingSystem/MsgLog";

const https = require('https')

const base = 1000;
const max = 999;
const num = 5;
const options = {
    hostname: 'www.random.org',
    port: 443,
    path: `/integers/?num=${num}&min=0&max=${max}&col=1&base=10&format=plain&rnd=new`,
    method: 'GET'
}
/**
 * This class provides an interface to the random.org service and thus helps to create true random numbers. If the service is not available it falls back automatically to the javascript class math.random
 */
export default class TrueRandom
{

    /**
     * 
     * @returns A true random number from random.org. If not reachable a random number from math.random is created. This random number can be used as a random seed for experiments.
     */
    static getSeed(): Promise<number>
    {
        let pr = new Promise<number>((resolve, reject) =>
        {
            let data = '';
            let numbers: Array<any>;
            const req = https.request(options, res =>
            {

                if (res.statusCode != 200)
                {
                    MsgLog.logDebug("Creating true randomness was unsuccessfull. Please check internet connectivity", this);
                    let rnd_min = 0;
                    let rnd_max = Math.pow(1000,6);
                    resolve(Math.floor(Math.random() * (rnd_max - rnd_min + 1)) + rnd_min);
                }

                res.on('data', d =>
                {
                    data += d;
                })

                res.on('end', () =>
                {
                    data = data.replace(/[\r\t]/g, "");
                    numbers = data.split("\n");
                    let seed = numbers.map((val, index) =>
                    {
                        return val as any * Math.pow(base, index); 
                    }).reduce((pr, cur) =>
                    {
                        return pr + cur;
                    })

                    MsgLog.logDebug("Creating true randomness successfully", this);
                    resolve(seed);
                })

                res.on('error', error =>
                {
                    MsgLog.logDebug("Creating true randomness was unsuccessfull. Please check internet connectivity", this);
                    console.error(error)
                    let rnd_min = 0;
                    let rnd_max = Math.pow(1000,6);
                    resolve(Math.floor(Math.random() * (rnd_max - rnd_min + 1)) + rnd_min);
                })

            })

            req.end()

        });
        return pr;

    }
}