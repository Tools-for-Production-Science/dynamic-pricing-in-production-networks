/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer (First version)

Copyright (c) 2021 Festo SE & Co. KG 

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import OrderV2 from "./OrderV2";
import { ResourceGroupV2 } from "./ResourceGroupV2";
import ProductV2 from "../ProductionNetworkModule/ProductV2";
import { EnvironmentConfiguration } from "../../../SystemManagement/Configuration/EnvironmentConfiguration";

export default class ResourceV2
{
    parent: ResourceGroupV2;
    queue: OrderV2[] = new Array();
    inMachining: OrderV2 | undefined = undefined;

    flagUsed: boolean = false;
    flagUsedKPI: boolean = false;
    private _machineID: number = 0;

    constructor(parent, id)
    {
        this.parent = parent
        this._machineID = id;
    }

    public get machineID(): number
    {
        return this._machineID;
    }


    /**
     * This function inserts an order into a specific index in the queue and updates all following orders accordingly
     * @param single_queue 
     * @param order 
     * @param index 
     * @param planTime 
     */
    insertIntoQueueAndUpdate(order: OrderV2, index: number)
    {
        let planTime;
        let duration = this.getProdTime(order);
        order.duration = duration;
        if ((index == 0) && (this.inMachining != undefined))
            planTime = duration + this.inMachining.plannedDate;
        else if (index == 0)
            planTime = duration + this.parent.sim.time();
        else
            planTime = this.queue[index - 1].plannedDate + duration;

        this.queue.splice(index, 0, order) //See https://stackoverflow.com/questions/586182/how-to-insert-an-item-into-an-array-at-a-specific-index-javascript

        //as order gets queued into this machine, flag is set to true
        this.flagUsed = true;
        this.flagUsedKPI = true;

        order.plannedDate = planTime; //Temporary plan time is now the actual plan
        //now update rest
        let temp = planTime;
        for (let index3 = index + 1; index3 < this.queue.length; index3++)
        {
            const next_order = this.queue[index3];
            temp = temp + next_order.duration;
            next_order.plannedDate = temp;
        }

        return;
    }

    /**
     * this function estimates the time of completion of an order if inserted into a given index in the queue
     * @param order 
     * @param index 
     * @returns 
     */
    estimateTimeOfCompletion(order: OrderV2, index: number): number
    {
        let planTime;
        let duration = this.getProdTime(order);
        if ((index == 0) && (this.inMachining != undefined))
            planTime = duration + this.inMachining.plannedDate;
        else if (index == 0)
            planTime = duration + this.parent.sim.time();
        else
            planTime = this.queue[index - 1].plannedDate + duration;

        return planTime;
    }

    /**
     * 
     * @returns the number of delayed orders
     */
    plannedDelays(): number
    {
        //define a variable that says if there is an inMachining delay
        let inMachiningPlannedDelay: number = 0;

        //check if there is an order on the machine from period to another
        if (this.inMachining)
        {
            if (this.inMachining.dueDate - this.inMachining.plannedDate >= 0)
            {
                //inMachining order is early
                inMachiningPlannedDelay = 0;
            } else
            {
                //inMachining order is delayed
                inMachiningPlannedDelay = 1;
            }
        }
        if (this.queue.length == 0)
            //return only the inMachining delay, because the queue is zero
            return inMachiningPlannedDelay;
        //return the number of delayed orders on the machine plus the inMachining delay
        return this.queue.map((order) =>
        {
            let res: number = 0;
            if (order.dueDate - order.plannedDate >= 0)
                res = 0;
            else
                res = 1;

            return res;
        }).reduce((pr, cur) =>
        {
            return pr + cur;
        }) + inMachiningPlannedDelay
    }
    /**
     * at each time step this function returns the current queue duration + the left duration of the order that is currently processed on the machine
     * @returns total left duration on machine
     */
    getTotalDurationInQueue(): number
    {
        let totalDuration = 0;

        if (this.inMachining)
        {
            totalDuration = this.inMachining.plannedDate - this.parent.sim.time();
        }
        if (this.queue.length > 0)
        {
            for (let index = 0; index < this.queue.length; ++index)
            {
                totalDuration += this.queue[index].duration;
            }
        }
        return totalDuration;
    }

     /**
     * Returns the sum of tardiness and lateness of all orders in the queue
     * @param forDelays states if the function should be executed for earliness (false) or tardiness (true)
     * @returns 
     */

    calcDeviationFromPlanned(forDelays: boolean): number
    {
        //define a variable for storing inMachining earliness or tardiness
        let inMachiningTardinessOrEarliness: number = 0;

        //check if there is an order on the machine from one period to another
        if (this.inMachining)
        {

            //check if we look at tardiness or earliness
            if (forDelays)
            {

                //compute the tardiness
                if ((this.inMachining.dueDate - this.inMachining.plannedDate) <= 0)
                {
                    inMachiningTardinessOrEarliness = (this.inMachining.plannedDate - this.inMachining.dueDate)
                } else
                {
                    inMachiningTardinessOrEarliness = 0
                }

            } else if (!forDelays)
            {

                //compute the earliness
                if ((this.inMachining.dueDate - this.inMachining.plannedDate) > 0)
                {
                    inMachiningTardinessOrEarliness = (this.inMachining.dueDate - this.inMachining.plannedDate)
                } else
                {
                    inMachiningTardinessOrEarliness = 0;
                }

            } else
            {
                inMachiningTardinessOrEarliness = 0
            }
        }

        if (this.queue.length == 0)
        {
            //return only the inMachining earliness or tardiness, because the queue length is 0
            return inMachiningTardinessOrEarliness;
        } else
        {
            //return the total earliness or tardiness plus the inMachining earliness or tardiness
            return this.queue.map((order) =>
            {
                let res: number = 0;
                //compute the tardiness
                if (forDelays)
                {
                    if ((order.dueDate - order.plannedDate) <= 0)
                    {
                        res = (order.plannedDate - order.dueDate)
                    } else
                    {
                        res = 0
                    }
                    //compute the earliness
                } else if (!forDelays)
                {
                    if ((order.dueDate - order.plannedDate) > 0)
                    {
                        res = (order.dueDate - order.plannedDate)
                    } else
                    {
                        res = 0;
                    }
                } else
                {
                    res = 0
                }

                return res;
            }).reduce((pr, cur) =>
            {
                return pr + cur;
            }) + inMachiningTardinessOrEarliness
        }


    }

    /**
     * calculates the production time for a given order
     * @param order order to produce
     * @returns time needed to produce
     */
    getProdTime(order: OrderV2)
    {     
        let baseTime = this.parent.MachineProductionRatePerPart.get(order.product.id)!;
        let time = this.parent.rnd.drawFromProb("triang", [0.95, 0.1, 0.5])*baseTime; //=>min=0.9, max=0.0+0.2, most probable value (c) = 0.9+0.2*0.5           
        return order.quantity * time;
    }

    /**
     * Calculate the revenue generated if the order is produced on this machine
     * @param order the order to produce
     * @param config the config of the environment
     */
    setRevenue(order: OrderV2, config: EnvironmentConfiguration)
    {
        if ((order.product as ProductV2).producttype != "Traffic")
        {
            let revenueRate = this.parent.RevenueRatePerUnitMap.get(order.product.id)
            let days = this.parent.sim.simTiming.getInBaseTime(1, "days") //Days for which penalities/inventory holding costs apply
            order.setBaseRevenue(revenueRate!, days, config)
        }
    }
}