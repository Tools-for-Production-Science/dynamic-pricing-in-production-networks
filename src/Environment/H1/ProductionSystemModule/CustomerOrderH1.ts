/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import IProductionOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProductionOrder";
import ICustomerOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/ICustomerOrder";
import IProduct from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProduct";
import MsgLog from "../../../SystemManagement/MessengingSystem/MsgLog";
import ProductH1 from "../ProductionNetworkModule/ProductH1";
import ProductionOrderH1 from "./ProductionOrderH1";
import { ProductionSystemH1 } from "./ProductionSystemH1";
import { EnvironmentConfiguration } from "../../../SystemManagement/Configuration/EnvironmentConfiguration";
export default class CustomerOrderH1 implements ICustomerOrder
{
    id = -1;
    prodSys: ProductionSystemH1;
    timeOfCreation = 0;
    ProductionOrders: IProductionOrder[] = [];
    products: IProduct[];

    private _dueDate: number = -1;
    private _dueTime: number = -1;
    quantity = 1;
    initialDueDate: number = -1;

    notOrderedByCustomer = false;

    staticRevenueRate = 0.15; //in H1 environemnt case, the revenue by the company is calculated as 15% fixed for all orders
    baseRevenue = 0;
    relativePriceSurcharge = 0;

    /**
     * full price surcharge for the complete order amount; addable to the base price to get the total price
     */
    public get fullSurcharge(): number
    {
        return this.relativePriceSurcharge * this.products.reduce((pr, cr, ci, ar) =>
        {
            return pr + cr.basePrice;
        }, 0);
    }

    /**
     * get the total revenue of an order. This is the value the company can have as profit.
     */
    public get totalRevenue(): number
    {
        if (this.notOrderedByCustomer == false)
        {
            return this.baseRevenue + this.fullSurcharge;
        }
        else
            return 0;
    }

    saved_Reward_ProdSys: number = 0;
    saved_ExpSmoothenedProdTimes: number[] = [];

    public get dueDate(): number
    {
        if (this._dueDate == -1)
        {
            return -1;
        }
        return this._dueDate;
    }

    public set dueDate(val: number)
    {
        this._dueDate = val;
    }

    public get dueTime(): number
    {
        if (this._dueTime == -1)
        {
            throw "dueTime of order was accessed before asigned";
            return -1;
        }
        return this._dueTime;
    }

    public set dueTime(val: number)
    {
        let fixedStates: number[] = [100, 200, 600, 700] // Diejenigen Produktionsschritte, die auf jeden Fall durchlaufen werden
        let minProdTime: number = 0;
        this.products.forEach(product =>
        {
            let tmp: number = 0;
            let tmp_order = new ProductionOrderH1(-1, -1, (product as ProductH1), this.prodSys.sim.time(), this, true);
            fixedStates.forEach(state =>
            {
                tmp += this.prodSys.pc.getMaxDurationForState(tmp_order, state, this.prodSys.MachineGroups);
            });
            if (tmp > minProdTime)
            {
                minProdTime = tmp;
            }
        })
        this._dueTime = val + minProdTime;
    }

    productionEnd: number = 0;
    customerID;


    /**
     * Creates a new customer order within the h1 environment
     * @param products the products to produce
     * @param timeOfCreation time stamp of creatuon
     * @param prodSys reference to the production system (only used to update the due time) 
     * @param customerID id of the order
     */
    constructor(products: IProduct[], timeOfCreation: number, prodSys: ProductionSystemH1, customerID: number)    
    {
        this.prodSys = prodSys;
        this.products = products;
        this.timeOfCreation = timeOfCreation;
        this.customerID = customerID;
    }

    isFinished(): boolean
    {
        let isFinished: boolean = true;
        this.ProductionOrders.forEach(prodOrder =>
        {
            if ((prodOrder as ProductionOrderH1).status != -1)
            {
                isFinished = false;
            }
        });
        return isFinished
    }

    /**
     * calculate the final revenue and save the production end time after the product was finished
     * @param productionEnd the time of finish (sim min)
     * @param baseUnitsPerDay conversion rate to calulcate form sim units to days
     * @param config the environment config; used to get costs or penalties
     */
    finalize(productionEnd: number, baseUnitsPerDay: number, config: EnvironmentConfiguration)
    {
        this.productionEnd = productionEnd;
        
        if (this.notOrderedByCustomer == false)
        {

            let delayEarlinessCostRate: number = 0;
            let numberOfPenaltyDays = Math.floor(Math.abs(this.productionEnd - this.dueDate) / baseUnitsPerDay);
            if ((this.productionEnd - this.dueDate) > 0)
            {
                delayEarlinessCostRate = Math.min(numberOfPenaltyDays * config.delayPenaltyCost, config.maximumDelayPenalty) //Penalty for delay
            } else
            {
                delayEarlinessCostRate = numberOfPenaltyDays * config.inventoryHoldingCost //Inventory holding costs
            }


            let revenueByProducts: number = 0;
            this.products.forEach(product =>
            {
                revenueByProducts += product.basePrice * (this.staticRevenueRate - delayEarlinessCostRate);
            });
            this.baseRevenue = revenueByProducts;
        }
    }
}