/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

/**
 * This is a piece of code not in use currently. It demonstrates how to map a bigger number of customers 
 * onto customer types which can be handled by the dynmaic pricing.
 */

import IOrder from "../GenericSimulationClasses/Interfaces/ICustomerOrder";
import * as tf from '@tensorflow/tfjs-node';
import { Random } from "simts";

class Memory
{
    actionsAr = new Array();
    limit: number = 2000;
    rand: Random;
    constructor(random)
    {
        this.rand = random;
    }

    addSample(action: number[], order: IOrder)
    {
        if (this.actionsAr.length > this.limit)
            this.actionsAr.shift();

        if (order.fullSurcharge < 0 || order.dueTime < 0)
            throw Error("Negotiated Price oder Due Time was smaller than zero");

        this.actionsAr.push([...action, ...[order.fullSurcharge / 10, order.dueTime / 50]])
    }

    sample(nSamples: number): Array<Array<any>>
    {
        if (this.actionsAr.length == 0)
            return new Array();

        let ar = new Array();
        let ar2 = new Array<number>(this.actionsAr.length);
        for (let index = 0; index < this.actionsAr.length; index++)
        {
            ar2[index] = index;
        }

        for (let index = 0; index < nSamples; index++)
        {

            let start = Math.floor(this.rand.random() * ar2.length);
            ar.push(this.actionsAr[ar2.splice(start, 1)[0]]);

            if (ar2.length == 0)
                break;
        }
        return ar;
    }
}
interface logObj
{
    accAvg: number;
}
export default class CustomerEstimator
{

    estimator = new Map<number, [tf.Sequential, Memory, logObj]>();
    nSample = 100;
    rand: Random;
    constructor(random)
    {
        this.rand = random;
    }

    async update(id: number, action: number[], order: IOrder)
    {
        let model, mem;
        if (this.estimator.get(id) == undefined)
        {
            const _model = tf.sequential();
            //Input = action-space + Preis + Lieferzeit (ausgemacht)
            _model.add(tf.layers.dense({ inputShape: [action.length], units: 10, useBias: true }));
            _model.add(tf.layers.leakyReLU());
            //_model.add(tf.layers.dense({ units: 10, useBias: true, activation: "relu" })); 
            _model.add(tf.layers.dense({ units: 2, useBias: true }));
            _model.add(tf.layers.leakyReLU());

            model = _model;

            model.compile({
                optimizer: tf.train.adam(0.02),
                loss: tf.losses.meanSquaredError,
                metrics: ['mse', 'accuracy'],
            });


            mem = new Memory(this.rand);
            this.estimator.set(id, [_model, mem, { accAvg: 0.5 }]);

        }
        else
            [model, mem] = this.estimator.get(id)!;

        (mem as Memory).addSample(action, order);

    }

    async train(id)
    {
        let model, mem, logObj: logObj;
        [model, mem, logObj] = this.estimator.get(id)!;

        const { inputs, labels } = tf.tidy(() =>
        {
            // Step 1. Shuffle the data
            let data = (mem as Memory).sample(this.nSample);
            //tf.util.shuffle(data);

            // Step 2. Convert data to Tensor
            const labels = data.map(d => d.slice(d.length - 2));
            const inputs = data.map(d => d.slice(0, d.length - 2));

            const inputTensor = tf.tensor2d(inputs);
            const labelTensor = tf.tensor2d(labels);

            //Step 3. Normalize the data to the range 0 - 1 using min-max scaling
            /*const inputMax = inputTensor.max();
            const inputMin = inputTensor.min();
            const labelMax = labelTensor.max();
            const labelMin = labelTensor.min();

            const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
            const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));*/

            return {
                inputs: inputTensor,
                labels: labelTensor,
            }
        });

        const batchSize = 40;
        const epochs = 60;

        return await model.fit(inputs, labels, {
            batchSize,
            epochs,
            shuffle: true,
            callbacks: {
                onEpochEnd: async (epoch, logs) =>
                {
                    logObj.accAvg = logObj.accAvg * 0.7 + 0.3 * logs.acc;
                    // Plot the loss and accuracy values at the end of every training epoch.
                }
            }
        });
    }

    async trainAll(minSamples = 5)
    {
        let model, mem: Memory, logObj: logObj, val;
        let numInteractions = 0;

        const iterator1 = this.estimator.values();
        val = iterator1.next().value;
        while (val != undefined)
        {

            [model, mem, logObj] = val;
            numInteractions += mem.actionsAr.length;
            if (minSamples > mem.actionsAr.length)
            {
                val = iterator1.next().value;
                continue;
            }

            const { inputs, labels } = tf.tidy(() =>
            {
                // Step 1. Shuffle the data
                let data = (mem as Memory).sample(this.nSample);
                //tf.util.shuffle(data);

                // Step 2. Convert data to Tensor
                const labels = data.map(d => d.slice(d.length - 2));
                const inputs = data.map(d => d.slice(0, d.length - 2));

                const inputTensor = tf.tensor2d(inputs);
                const labelTensor = tf.tensor2d(labels);

                //Step 3. Normalize the data to the range 0 - 1 using min-max scaling
                /*const inputMax = inputTensor.max();
                const inputMin = inputTensor.min();
                const labelMax = labelTensor.max();
                const labelMin = labelTensor.min();
    
                const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
                const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));*/

                return {
                    inputs: inputTensor,
                    labels: labelTensor,
                }
            });

            const batchSize = 40;
            const epochs = 60;

            await model.fit(inputs, labels, {
                batchSize,
                epochs,
                shuffle: true,
                callbacks: {
                    onEpochEnd: async (epoch, logs) =>
                    {
                        //console.log(epoch);
                        //console.log(logs);
                        logObj.accAvg = logObj.accAvg * 0.7 + 0.3 * logs.acc;
                        // Plot the loss and accuracy values at the end of every training epoch.
                    }
                }
            });
            console.log("finish training of one estimator");
            val = iterator1.next().value;
        }
        console.log("finish training of all estimators");
        console.log("number of interactions: " + numInteractions);
    }

    getEstimation(id, action)
    {
        return (this.estimator.get(id)![0].predict(tf.tensor2d(action, [1, 3])) as tf.Tensor).dataSync();
    }

}