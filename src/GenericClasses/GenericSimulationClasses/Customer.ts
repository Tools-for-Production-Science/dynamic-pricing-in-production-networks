/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer (First version)

Copyright (c) 2021 Festo SE & Co. KG 

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import IDemand from "./Interfaces/IDemand";
import ICustomerOrder from "./Interfaces/ICustomerOrder";
import IProduct from "./Interfaces/IProduct";
import { Random } from "simts";
import { EnvironmentConfiguration } from "../../SystemManagement/Configuration/EnvironmentConfiguration";
import MsgLog from "../../SystemManagement/MessengingSystem/MsgLog";
import OrderV2 from "../../Environment/V2/ProductionSystemModule/OrderV2";
import DemandV2 from "../../Environment/V2/ProductionNetworkModule/DemandV2";
import ProductV2 from "../../Environment/V2/ProductionNetworkModule/ProductV2";
import { EngineV2 } from "../../Environment/V2/EngineV2";
import IEngine from "./Interfaces/IEngine";
import { Environment } from "../../SystemManagement/Configuration/EnvironmentEnum";


export default class Customer
{
    private _id = -1;
    portfolio = new Array<IProduct>();
    totalUtility: number = 0;
    curUtility: number = 0;
    //individuelle Parameter der Kunden
    a: number;
    b: number;
    d_: number;
    v: number;

    //saves initial parameters of customers, only relevant vor scenarios
    startB: number;
    startD_: number;
    startV: number;



    envConfig: EnvironmentConfiguration;
    name: String = "unknown";
    engine: IEngine;

    random: Random;
    drift: number = 0;

    demands = new Array<IDemand>();

    /**
     * The customer class simulates the behavior of a customer. Each customer has an individual utility function depening on prive and delivery time. The function follows the form of a inversed hockey stock, meaning too late delivery decreases utility dramatically,
     * too early deliveries are also decreasing the utility but less. The customer expexts the three parameters of a price function in order to determine the optimal price delivery combination. The price function is already inserted into the utility function. 
     * The optimal point is determined using classic algebra. 
     * @param engine The egnine object
     * @param envConfig the environment configuration
     * @param id the (unique) id of the customer
     * @param random the random object in order to create random numbers
     * @param a first parameter of utility function (steepness)
     * @param b second parameter of utility function (preferred delivery time)
     * @param d_ third parameter of utility function (willingness to pay)
     * @param v fourth parameter of utility function (willingness to pay 2)
     */
    constructor(engine: IEngine, envConfig: EnvironmentConfiguration, id, random: Random, a = 0.01, b = 10, d_ = 0.25, v = 0.75)
    {
        this._id = id;
        this.a = a;
        this.b = b;
        this.d_ = d_;
        this.v = v;
        this.envConfig = envConfig;
        this.random = random;
        this.engine = engine;

        this.startB = b;
        this.startD_ = d_;
        this.startV = v;
    }
    
    /**
     * This function takes the previously drawn order, communiates with the ML Agent, then optimizes the delivery time to cost trade off 
     * based on an individual utility function and returns the order
     * @param order The temporary order object
     * @actionsKI actionsKI The choosen action 
     */
    requestAndChoose(order: ICustomerOrder, actionsKI: any): ICustomerOrder | null
    {
        //Get pararmeters from KI

        //Default parameters
        let k = 0.1;
        let l = 7.0;
        let n_ = 0.0

        if (actionsKI[0] == undefined)
        {
            throw 'something went wrong, action was not retunred as array'
        }

        if (actionsKI[2] != undefined)
        {
            k = actionsKI[0]
            l = actionsKI[1];
            n_ = actionsKI[2];
        } else
        {
            throw 'not three actions were choosen'
        }


        //set the negotiated due date for each order as the due date from the utility function (or static lead time) + the duration of the order. This avoids that due dates are negotiated that can never be met.
        let dueTime = -1;
        if (this.envConfig.useAI)
        {
            dueTime = this.chooseByUtilityFunction(k, l, n_);

        } else 
        {
            if (!this.envConfig.dynamicLeadTime)
            {
                //static Price, static Leadtime
                dueTime = this.engine.sim.simTiming.getInBaseTime(this.envConfig.staticLeadTime, "days");
            } else
            {
                //static Price, dynamic Leadtime (Optimum of customer) all orders will be accepted
                dueTime = this.engine.sim.simTiming.getInBaseTime(this.b, "days") //  Kunde kann aus Lieferzeit-Preis Angebot auswählen und wählt sein Optimum 
            }
        }
        
        order.dueTime = dueTime;

        this.curUtility = this.getUtility(k, l, n_, (dueTime) / this.engine.sim.simTiming.getInBaseTime(1, "days"));

        MsgLog.log(MsgLog.types.debug, 'utility is' + this.curUtility, this)

        if (this.curUtility >= 0)
        {
            this.totalUtility += this.curUtility;

            //Calculate paid price for negotiated leadTime
            if (order.products[0].producttype != "Traffic") //Revenue kann nur geupdated werden, wenn es sich um ein ADN-Zylinder handelt, für alle anderen Materialien stehen keine Daten zur Verfügung
            {
                if (this.envConfig.useAI)
                {
                    let dueTimeInDays = dueTime / this.engine.sim.simTiming.getInBaseTime(1, "days");
                    order.relativePriceSurcharge = k * Math.exp(-dueTime + l) - k * (-dueTimeInDays + l) - k + n_;
                } else
                {
                    order.relativePriceSurcharge = this.envConfig.staticPriceRelativeSurcharge;
                }
            }

            if (this.engine.productionNetwork.driftStarted)
                this.benchmarkscenario(this.engine.config.envConfig.scenario);
            return order;
        } else
        {
            (order).notOrderedByCustomer = true;
            order.dueDate = -1
            MsgLog.log(MsgLog.types.debug, 'order is null', this)
            if (this.engine.productionNetwork.driftStarted)
                this.benchmarkscenario(this.engine.config.envConfig.scenario);
            return order;
        }

    }

    /**
     * Calculates the optimal value for the customer based on its parameters
     * @param k from price function
     * @param l from price function
     * @param m from price function
     * @param n from price function
     * @returns the negotiated due date
     */
    chooseByUtilityFunction(k: number, l: number, n_: number): number
    {
        //n will not be used as it is not part of the calculation
        //Mitternachtsformel
        //notwendige Bedingung df/dt = 0
        let x1 = Math.log((this.a - k) + Math.sqrt((this.a - k) ** 2 + 4 * this.a * Math.exp(-this.b) * k * Math.exp(l))) - Math.log(2 * this.a * Math.exp(-this.b));
        let x2 = Math.log((this.a - k) - Math.sqrt((this.a - k) ** 2 + 4 * this.a * Math.exp(-this.b) * k * Math.exp(l))) - Math.log(2 * this.a * Math.exp(-this.b));

        let x;
        //hinreichende Bedingung df²/dt < 0
        if (-this.a * Math.exp(x1 - this.b) - k * Math.exp(l - x1) < 0)
            x = x1;
        else if (-this.a * Math.exp(x2 - this.b) - k * Math.exp(l - x2) < 0)
            x = x2;
        else
            throw "no max found in utility function";

        MsgLog.log(MsgLog.types.debug, "KI parametrisiert: " + l + " Kunde will: " + x, this, false, false);
        return this.engine.sim.simTiming.getInBaseTime(x, "days");

    }

    /**
     * Calculates the utility for a specific value x
     * @param x Value for which the utility should be calculated
     * @param k from price function
     * @param l from price function
     * @param n_ from price function
     * @returns the utitliy at x
     */
    getUtility(k, l, n_, x): number
    {
        if (this.envConfig.useAI)
        {
            return -this.a * Math.exp(x - this.b) + this.a * (x - this.b) + this.a + this.d_ + this.v - k * Math.exp(-x + l) + k * (-x + l) + k - n_;
        }
        else
        {
            return -this.a * Math.exp(x - this.b) + this.a * (x - this.b) + this.a + this.d_ + this.v - this.envConfig.staticPriceRelativeSurcharge;
        }
    }

    public get id(): number
    {
        return this._id
    }

    private benchmarkscenario(scenario: number)
    {
        switch (scenario)
        {
            case 1: //Keine Drift der Kunden in irgendeine Richtung, Feste Kunden von Anfang an
            case 4:
            case 5:
                break;

            case 2: //Drift zu kurzfristigen Kunden
            case 6:
                if (this.b <= 3.0)
                {
                    break;
                }

                //Each customer reduces its leadtime preference with bDriftReductionInDays
                if (this.startB - this.envConfig.bDriftReductionInDays < this.b)
                {
                    this.b -= this.envConfig.bDriftReductionInDays / (this.envConfig.reductionBase / this.envConfig.customerAmount)
                }
                break;

            case 3: //Drift zu preissensitiven Kunden
            case 7:
                if (this.d_ + this.v <= 0.8)
                {
                    break;
                }


                if (this.startD_ - this.envConfig.dDriftReduction < this.d_)
                {
                    this.d_ -= this.envConfig.dDriftReduction / (this.envConfig.reductionBase / this.envConfig.customerAmount) //in Analogie zu oben, muss die Preissensitivität, 0.00001 pro Auftrag abnehmen
                }
                if (this.startV - this.envConfig.vDriftReduction < this.v)
                {
                    this.v -= this.envConfig.vDriftReduction / (this.envConfig.reductionBase / this.envConfig.customerAmount) //in Analogie zu oben, muss die Preissensitivität, 0.00001 pro Auftrag abnehmen
                }

                break;
        }


    }
}
