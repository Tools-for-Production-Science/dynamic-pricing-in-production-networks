/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { ResourceGroupH1 } from "./ResourceGroupH1";
import ProductionOrderH1 from "./ProductionOrderH1";

export default class ResourceH1
{
    parent: ResourceGroupH1;
    queue: ProductionOrderH1[] = new Array();
    machineID;
    inMachining: ProductionOrderH1 | undefined = undefined;
    parallelOrders = new Set<ProductionOrderH1>();

    constructor(parent: ResourceGroupH1, id: number)
    {
        this.parent = parent
        this.machineID = id
    }

    /**
     * This function inserts an order into a specific index in the queue and updates all following orders accordingly
     * @param single_queue 
     * @param order 
     * @param index 
     * @param planTime 
     */
    insertIntoQueueAndUpdate(order: ProductionOrderH1, index: number)
    {
        let resource_group = this.parent

        let dur
        dur = resource_group.ProductionTime.get(order.product.id)
        let planTime;
        if (index == 0 && this.inMachining != undefined)
            planTime = dur + this.inMachining.plannedDate;
        else if (index == 0)
            planTime = dur + this.parent.sim.time();
        else
            planTime = this.queue[index - 1].plannedDate + dur;

        this.queue.splice(index, 0, order) //See https://stackoverflow.com/questions/586182/how-to-insert-an-item-into-an-array-at-a-specific-index-javascript

        order.plannedDate = planTime; //Temporary plan time is now the actual plan
        //now update rest
        let temp = planTime;
        for (let index3 = index + 1; index3 < this.queue.length; index3++)
        {
            const next_order = this.queue[index3];
            temp = temp + this.parent.ProductionTime.get(order.product.id);
            next_order.plannedDate = temp;
        }

        return;
    }


    /**
     * at each time step this function returns the current queue duration + the left duration of the order that is currently processed on the machine
     * @returns total left duration on machine
     */
    getTotalDurationInQueue(): number
    {
        if (this.parent.parallel == true)
        {
            return 0
        }

        let totalDuration = 0;

        if (this.inMachining)
        {
            totalDuration = this.inMachining.plannedDate - this.parent.sim.time();
        }
        if (this.queue.length > 0)
        {
            for (let index = 0; index < this.queue.length; ++index)
            {
                let id: number = this.queue[index].product.id
                totalDuration += this.parent.ProductionTime.get(id)!;
            }
        }

        return totalDuration;

    }
    /**
     * Returns the production time for an order
     * @param order 
     * @returns the production time as a number
     */
    getProdTime(order: ProductionOrderH1): number
    {
        let prodTime: number = (this.parent.ProductionTime.get(order.product.id))!
        return prodTime;
    }
}