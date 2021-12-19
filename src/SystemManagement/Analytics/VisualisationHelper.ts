/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { chartType } from "./Analytics";
import { Report } from "./Report";

export class VisualisationHelper
{

    /**
     * Creates an empty chartdate object for a given type, e.g. line chart and here basic format like colors, background etc. 
     * Also it adds empty arrays for labels and datasets.data to be filled.
     * @returns The chartdata object for a line chart
     */
    createChartDataObject(type: chartType)
    {
        let chartDataObject = {};
        switch (type)
        {
            case "line":
                chartDataObject = this.createLineChartObject();
                break;
            case "story":
                chartDataObject = this.createStoryChartObject();
                break;
            case "bar":
                chartDataObject = this.createBarChartObject();
                break;
            case "log":
                chartDataObject = this.createLogChartObject();
        }

        return chartDataObject;
    }
    private createLineChartObject(): object
    {
        let chartData = {};
        chartData["labels"] = new Array<string>();
        chartData["datasets"] = new Array<object>();
        chartData["datasets"].push({
            label: "lineChart",
            data: new Array<number>(),
            fill: false,
            borderColor: "#2554FF",
            backgroundColor: "#2554FF",
            borderWidth: 1
        })
        return chartData;
    }

    private createStoryChartObject(): object
    {
        let chartData = {};
        chartData["labels"] = new Array<string>();
        chartData["datasets"] = new Array<[]>();

        chartData["datasets"].push({
            data: new Array<number | string>(),
        })
        return chartData;
    }

    private createBarChartObject(): object
    {

        let chartData = {};
        chartData["labels"] = new Array<string>();
        chartData["datasets"] = new Array<object>();
        chartData["datasets"].push({
            label: "Bar Chart",
            borderWidth: 1,
            backgroundColor: [
                "rgba(255, 99, 132, 0.2)",
                "rgba(54, 162, 235, 0.2)",
                "rgba(255, 206, 86, 0.2)",
                "rgba(75, 192, 192, 0.2)",
                "rgba(153, 102, 255, 0.2)",
                "rgba(255, 159, 64, 0.2)",
                "rgba(255, 99, 132, 0.2)",
                "rgba(54, 162, 235, 0.2)",
                "rgba(255, 206, 86, 0.2)",
                "rgba(75, 192, 192, 0.2)",
                "rgba(153, 102, 255, 0.2)",
                "rgba(255, 159, 64, 0.2)"
            ],
            borderColor: [
                "rgba(255,99,132,1)",
                "rgba(54, 162, 235, 1)",
                "rgba(255, 206, 86, 1)",
                "rgba(75, 192, 192, 1)",
                "rgba(153, 102, 255, 1)",
                "rgba(255, 159, 64, 1)",
                "rgba(255,99,132,1)",
                "rgba(54, 162, 235, 1)",
                "rgba(255, 206, 86, 1)",
                "rgba(75, 192, 192, 1)",
                "rgba(153, 102, 255, 1)",
                "rgba(255, 159, 64, 1)"
            ],
            pointBorderColor: "#2554FF",
            data: new Array<number>(),
        })
        return chartData;
    }

    private createLogChartObject(): object
    {
        let chartData = {};
        chartData["labels"] = new Array<string>();
        chartData["datasets"] = new Array<object>();
        chartData["datasets"].push({
            data: new Array<number>(),
        })
        return chartData;
    }

    private createPieChartObject(): object
    {
        throw new Error("Not Implemented!");
    }
}