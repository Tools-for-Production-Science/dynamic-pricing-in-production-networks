/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import ProductH1 from "./ProductH1";
import { Random } from "simts";
import Customer from "../../../GenericClasses/GenericSimulationClasses/Customer";
import IDemand from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IDemand";
import { DistributionType } from "simts";

export default class DemandH1 implements IDemand
{
    private random: Random;
    private timeDistributionParameters: number[];
    private distribution: DistributionType;
    product: ProductH1[];
    firstDate: number;
    customer: Customer;
    triggerFirstDemand = true;

    constructor(random: Random, customer: Customer, product: ProductH1[], nextDate: number, distribution: DistributionType, timeDistributionParameters: Array<number>)
    {
        this.timeDistributionParameters = timeDistributionParameters;
        this.product = product
        this.firstDate = nextDate
        this.customer = customer;
        this.distribution = distribution;
        this.random = random;
    }

    getNextDate()
    {
        if(this.triggerFirstDemand)
        {
            this.triggerFirstDemand = false;
            return this.firstDate;            
        }
        let nextDateIn = this.random.drawFromProb(this.distribution, this.timeDistributionParameters);
        return nextDateIn
    }

    drawQuantity()
    {
        return 1;
    }
}
