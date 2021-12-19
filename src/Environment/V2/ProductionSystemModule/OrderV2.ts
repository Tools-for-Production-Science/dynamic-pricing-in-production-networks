/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import ICustomerOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/ICustomerOrder";
import IProduct from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProduct";
import IProductionOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProductionOrder";
import { EnvironmentConfiguration } from "../../../SystemManagement/Configuration/EnvironmentConfiguration";
import ProductV2 from "../ProductionNetworkModule/ProductV2";

export default class OrderV2 implements ICustomerOrder, IProductionOrder
{
    id = -1

    notOrderedByCustomer = false;

    timeOfCreation = 0;
    quantity: number;
    duration: number = 0;

    product: IProduct;
    /**
     * In the interface an array of products is expected. But in the V2 case each order has only one product. This solves the issue
     */
    public get products(): IProduct[]
    {
        return [this.product];
    }

    /**
     * Not relevant for V2 case
     */
    ProductionOrders: IProductionOrder[] = [];


    /**
     * the surcharge relative to the base price. Will be multiplied with the base price to get the absoluteSurcharge
     */
    relativePriceSurcharge = 0;

    /**
     * In V2 environemnt the customer order is always equal to the production order.
     */
    customerOrder = this;

    /**
     * full price surcharge for the complete order amount; addable to the base price to get the total price
     */
    public get fullSurcharge(): number
    {
        return this.quantity * this.product.basePrice * this.relativePriceSurcharge ; //* relative * price
    }

    /**
     * Includes the margin of an order (amount * price) minus delivery date deviation cost
     */
    baseRevenue: number = 0;

    /**
     * get the total revenue of an order. This is the value the company can have as profit.
     */
    public get totalRevenue(): number
    {
        return this.baseRevenue + this.fullSurcharge;
    }

    /**
     * the negtioated due date in seconds relative to simulation start date
     */
    dueDate: number = -1;

    private _dueTime: number = -1;

    /**
     * the due time of the order as the absolute time available to produce the order
     */
    public get dueTime(): number
    {
        return this._dueTime;
    }
    /**
     * the due time of the order as the absolute time available to produce the order
     */
    public set dueTime(val)
    {
        this._dueTime = val + (this.product as ProductV2).baseProductionDuration * this.quantity;
    }

    /**
     * The forecasted date when the order will be finished according to the production planning and control
     */
    plannedDate: number = -1;
    /**
     * Start date of production. Can be used for analysing the simulation
     */
    productionStart: number = -1;
    /**
     * The date of finish.
     */
    productionEnd: number = -1;


    /**
     * 
     * @param quantity 
     * @param product Es darf nur Product aus Environment V2 übergeben werden 
     * @param timeOfCreation 
     */
    constructor(quantity: number, product: IProduct, timeOfCreation: number)
    {
        this.quantity = quantity;
        this.product = product;
        this.timeOfCreation = timeOfCreation;
    }

    /**
     * Calculate the generated revenue for a product based on its base price, a margin (revenue rate) and the subtracted penalties or cost
     * @param revenueRate the margin in decimal of a price
     * @param baseUnitsPerDay Conversion from one day to simulation time units in order to have the same units for all values
     * @param config the environment config; used to get penalty or cost values
     */
    setBaseRevenue(revenueRate: number, baseUnitsPerDay: number, config: EnvironmentConfiguration)
    {
        let delayEarlinessCostRate = 0
        let numberOfPenaltyDays = Math.floor(Math.abs(this.productionEnd - this.dueDate) / baseUnitsPerDay)

        if ((this.productionEnd - this.dueDate) > 0)
        {
            delayEarlinessCostRate = Math.min(numberOfPenaltyDays * config.delayPenaltyCost, config.maximumDelayPenalty) //Penalty for delay
        } else
        {
            delayEarlinessCostRate = numberOfPenaltyDays * config.inventoryHoldingCost //Inventory holding costs
        }

        this.baseRevenue = (this.quantity * (this.product as ProductV2).basePrice) * (revenueRate - delayEarlinessCostRate)
    }
}