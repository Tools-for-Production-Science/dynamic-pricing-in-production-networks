/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { Random } from "simts";
import ProductH1 from "../ProductionNetworkModule/ProductH1";

export default class TrafficH1
{
    interarrival:number;
    product:ProductH1;
    nextDate:number;
    random:Random;

    /**
     * creates a traffic demand to model orders which are not in scope of the core model but will use capacity and therefore must be considered as well
     * @param product 
     * @param interArrival 
     * @param random 
     */
    constructor(product:ProductH1,interArrival:number,random:Random)
    {
        this.product = product;
        this.random = random;
        this.interarrival = interArrival;
        this.nextDate = this.random.drawFromProb("uni",[0,this.interarrival])
    }
    getDur():number
    {
        return Math.round(this.random.drawFromProb("expon",[0,this.interarrival]))
    }
}