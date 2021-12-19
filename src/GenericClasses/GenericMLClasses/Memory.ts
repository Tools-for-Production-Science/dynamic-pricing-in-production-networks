/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/
import { Random } from "simts";

export class Memory
{

    //define attributes of the memory
    samples: Array<any>;
    rand: Random;
    /**
     * initialize the attributes through constructor
     * @param configurationObject takes a configuration object for initialization
     */
    constructor(rand: Random)
    {
        this.samples = new Array<any>();
        this.rand = rand;
    }

    /**
     * function for adding a sample to the memory
     * @param sample takes an array object to add to the memory
     */
    addSample(sample: Array<any>): void
    {
        this.samples.push(sample);
    }

    /**
     * function to sample randomly from the existing memory (experience replay)
     * @param nSamples number of samples to return; if -1 all samples will be returned shuffled
     * @returns returns a number of samples
     */
    sample(nSamples: number): Array<any>
    {
        if (this.samples.length == 0)
            return new Array();

        if (nSamples == -1)
            nSamples = this.samples.length;

        let ar = new Array();
        let ar2 = new Array<number>(this.samples.length);
        for (let index = 0; index < this.samples.length; index++)
        {
            ar2[index] = index;
        }

        for (let index = 0; index < nSamples; index++)
        {

            let start = Math.floor(this.rand.random() * ar2.length);
            ar.push(this.samples[ar2.splice(start, 1)[0]]);

            if (ar2.length == 0)
                break;
        }
        return ar;
    }
}

