/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { chartType } from "./Analytics";

export default class Visualisation
{
    chartObject: object;
    id: number;
    maxRange: number | undefined;
    title: string;
    type: chartType;


    /**
     * Create a new visualisation with a given type
     * @param id id of the visualisation
     * @param title title of the visualisation
     * @param type chartytpe following the chartype from Analytics.ts
     * @param chartObject the raw object of a chart element prepared from visualisationhelper
     * @param maxRange the maxRange of data to show.
     */
    constructor(id: number, title: string, type: chartType, chartObject: object, maxRange: number | undefined)
    {
        this.id = id;
        this.chartObject = chartObject;
        this.maxRange = maxRange;
        this.title = title;
        this.type = type;
    }
    /**
     * add data to the visualisation
     * @param label label of the data point
     * @param data data point
     */
    addData(label: string|number, data: number|string)
    {
        if (this.maxRange == 0)
            return;

        if (this.type != "story" &&
            this.type != "log" &&
            typeof (data) == "string")
            return false;

        let chartdata = this.chartObject["chartData"];
        chartdata.labels.push(label);
        chartdata.datasets[0].data.push(data);

        if (this.maxRange != undefined && this.maxRange > 0)
        {
            if (chartdata.labels.length > this.maxRange)
            {
                chartdata.labels.splice(0, chartdata.labels.length - this.maxRange!); //trim array to this length
                chartdata.datasets[0].data.splice(0, chartdata.datasets[0].data.length - this.maxRange!); //trim array to this length
            }
        }
    }
}