/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer (First version)

Copyright (c) 2021 Festo SE & Co. KG 

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import IProduct from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProduct";
import { Random, DistributionType } from "simts";

export default class ProductV2 implements IProduct
{

    id: number;
    prob: number;
    private dis: DistributionType;
    private disparam: number[];
    producttype: string;
    random: Random;
    /**
     * Used to save the numbers of customers who have a demand for this product
     */
    numCustomers: number = 0;
    /**
     * Defines the minimum time needed to produce this product
     */
    baseProductionDuration: number = 0;
    /**
     * Base price without any negotiation
     */
    basePrice: number;

    /**
     * The specific product for the V2 environment
     * @param id of the product (unique!)
     * @param prob not used anymore
     * @param dis not used anymore
     * @param disparam parameters of distribution
     * @param producttype can be set to traffic or non traffic
     * @param price base price of product
     * @param random reference to the source of randomness
     */
    constructor(id, prob, dis, disparam, producttype, price, random)
    {
        this.id = id;
        this.prob = prob;
        this.dis = dis;
        this.disparam = disparam.map(x => Number(x));
        this.random = random;
        this.producttype = producttype;

        this.basePrice = price;
    }
    /**
     * This function returns the order-quantity with respect to the distribution
     */
    drawQuantity(factor: number): number
    {
        let param = [...this.disparam]
        param.pop() //delete variance
        param.pop() //delete mean value
        param[1] = param[1] / factor; //adapt poisson distribution
        return this.random.drawFromProb(this.dis, param);
    }


    /**
     * 
     * @returns standard deviation of quantity for this product
     */
    getStd(): number
    {
        return this.disparam[this.disparam.length - 1]

    }

    /**
     * 
     * @returns mean quantity for this product
     */
    getMean(): number
    {
        return this.disparam[this.disparam.length - 2]
    }
}

