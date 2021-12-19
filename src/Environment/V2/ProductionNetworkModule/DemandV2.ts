/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import MsgLog from "../../../SystemManagement/MessengingSystem/MsgLog";
import ProductV2 from "./ProductV2";
import { Random, Sim, DistributionType } from "simts";
import IProduct from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProduct";
import IDemand from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IDemand";
import { EngineV2 } from "../EngineV2";

export default class DemandV2 implements IDemand
{

    private random: Random;
    private timeDistribution: DistributionType;
    private timeDistributionParameters: Array<number>;
    product: IProduct[];
    engine: EngineV2;

    /**
     * This is a specific demand for the V2 environment
     * @param engine a reference to the engine
     * @param product the product for which the demand is for
     * @param random a reference to the source of randomness
     * @param timeDistribution the distribution from which the next demand date is drawn
     * @param timeDistributionParameter parameters for the distribution 
     */
    constructor(engine: EngineV2, product: IProduct, random: Random, timeDistribution: DistributionType, timeDistributionParameter: Array<number>)
    {
        this.product = [product];
        this.random = random;
        this.timeDistribution = timeDistribution;
        this.timeDistributionParameters = timeDistributionParameter;
        this.engine = engine;
    }

    /**
     * 
     * @returns the next time in base units from the moment of calling this function (must be called immediatly after the last date to stick to the distribution)
     */
    getNextDate()
    {
        return this.random.drawFromProb(this.timeDistribution, this.timeDistributionParameters);
    }
    /**
     * 
     * @returns the quantity of the demand
     */
    drawQuantity()
    {
        let factor = 0;
        if (this.timeDistribution == this.random.distribution.exponential)
        {
            factor += (this.timeDistributionParameters[1] + this.timeDistributionParameters[0]); //Exponentialverteilung hat einen Erwartungswert von 1/lambda + mu
        } else if (this.timeDistribution == this.random.distribution.uniform)
        {
            factor += this.timeDistributionParameters[0] + 0.5 * (this.timeDistributionParameters[1]);
        } else
        {
            throw "not implemented exception";
        }

        if (this.product[0].numCustomers == 0)
            throw "Anzahl Kunden wurde nicht im Produkt hinterlegt";

        factor = this.engine.sim.simTiming.getInBaseTime(1, "months") / factor; //NormEinheiten / erwarte Ankunftsrate
        factor *= this.product[0].numCustomers; //das geht nur, wenn alle Kunden die selbe Bestellzwischenankunftszeit haben!
        return Math.round((this.product[0] as ProductV2).drawQuantity(factor));
    }

}