/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import ResourceH1 from "./ResourceH1";
import MsgLog from "../../../SystemManagement/MessengingSystem/MsgLog";
import { ResourceGroupH1 } from "./ResourceGroupH1";
import ProductH1 from "../ProductionNetworkModule/ProductH1";
import ProductionOrderH1 from "./ProductionOrderH1";

export default class ProductionControlH1
{

    /**
     *  Plans an order into an amount of machines based on the minimum slack rule
     * @param sort 
     * @param order 
     * @param MachineGroups 
     * @returns 
     */
    planOrder(sort: ResourceH1[], order: ProductionOrderH1, MachineGroups: Map<number, ResourceGroupH1>): ResourceH1 
    {
        let chosenCapa: ResourceH1 | null = null;
        //1. Finde die am vorletzten meist ausgelastete Maschine
        //2.1. Sortiere den Auftrag in die Queue & teste, ob das hinhaut
        //2.2. Wenn nicht, gehe zur nächstgrößeren Schlange, probiere es dort, bis zuletzt zur wenigsteausgelasteten Schlange
        //2.3 Wenn es immer noch nicht geht, buche trotzdem die wenigstausgelastete Schlange
        //3. (außer bei 2.3) Prüfe, ob Folgeausträge noch rechtzeitig fertig werden. Wenn nicht gehe zu 2.2

        //Sort queue by capacity


        sort.sort((MachineA, MachineB) => MachineA.getTotalDurationInQueue() - MachineB.getTotalDurationInQueue())

        if (sort.length == 1)
        {
            MsgLog.log(MsgLog.types.debug, "Only one machine| name: " + sort[0].parent.name, this, false, true)
            chosenCapa = this.checkQueueAndInsert(sort[0], order, MachineGroups);
            if (chosenCapa == null)
            {
                chosenCapa = this.findBestSlotForOrderAndInsert(sort, order, MachineGroups);

            }
        }
        else 
        {

            for (let index = 1; index < sort.length; index++)
            {
                const single_queue = sort[index];
                //s. Schritt 2.1

                chosenCapa = this.checkQueueAndInsert(single_queue, order, MachineGroups);
                if (chosenCapa != null)
                {
                    break;
                };

            }
            if (chosenCapa == null)//Sonderfall alle Maschinen ausgelastet, nutze die "geschonte" Maschine beim index = 0
            {
                chosenCapa = this.findBestSlotForOrderAndInsert(sort, order, MachineGroups);
            }
        }
        MsgLog.logDebug("Chosen machine name: " + chosenCapa!.parent.name + " machine ID: (" + chosenCapa!.machineID + ") total duration in queue: " + chosenCapa!.getTotalDurationInQueue(), this, true)


        return chosenCapa!;
    }

    /**  
     * Return the maximum duration (lead time left) for a order in a defined status
     */
    getMaxDurationForState(order: ProductionOrderH1, state: number, MachineGroups: Map<number, ResourceGroupH1>): number
    {
        let machines: number[] = order.product.routeSheet.getMachines(state);
        let max_duration: number = 0;
        machines.forEach((machine) =>
        {
            let mach_duration = MachineGroups.get(machine)?.ProductionTime.get(order.product.id);
            if (mach_duration! > max_duration)
            {
                max_duration = mach_duration!;
            }
        });
        return max_duration
    }

    private checkQueueAndInsert(single_queue: ResourceH1, order: ProductionOrderH1, MachineGroups: Map<number, ResourceGroupH1>): ResourceH1 | null
    {
        let orderPlanned = false;
        if (single_queue.queue.length == 0)
        {
            if (single_queue.inMachining == undefined)
            {
                if (single_queue.parent.sim.simTime + single_queue.parent.ProductionTime.get(order.product.id)! + this.getMaxFollowingDuration(order, order.status, 0, MachineGroups) < order.dueDate)
                {
                    single_queue.insertIntoQueueAndUpdate(order, 0);
                    return single_queue;
                }
            }
            else
            {
                if (single_queue.inMachining.plannedDate + single_queue.parent.ProductionTime.get(order.product.id)! + this.getMaxFollowingDuration(order, order.status, 0, MachineGroups) < order.dueDate)
                {
                    single_queue.insertIntoQueueAndUpdate(order, 0);
                    return single_queue;
                }
            }
            return null;
        }
        else
        {
            for (let index2 = 0; index2 < single_queue.queue.length; index2++)
            {
                const queued_order = single_queue.queue[index2];
                let slip_queued_order: number = queued_order.dueDate - this.getMaxFollowingDuration(queued_order, queued_order.status, 1, MachineGroups);
                let slip_order: number = order.dueDate - this.getMaxFollowingDuration(order, order.status, 1, MachineGroups)
                if (slip_queued_order > slip_order)
                {
                    let tempPlan = single_queue.parent.sim.time() + this.getProdTime(single_queue, order.product);
                    if (index2 != 0) 
                    {
                        tempPlan = single_queue.queue[index2 - 1].plannedDate + this.getProdTime(single_queue, order.product)
                    }

                    if (tempPlan < order.dueDate)
                    {
                        let trigger = true;
                        let planned = tempPlan;
                        for (let index3 = index2; index3 < single_queue.queue.length; index3++)
                        {
                            const next_order = single_queue.queue[index3];
                            if (planned + this.getProdTime(single_queue, next_order.product) > next_order.dueDate)
                            {
                                trigger = false;
                                break;
                            }
                            planned = planned + this.getProdTime(single_queue, next_order.product);

                        }
                        if (trigger)
                        {
                            orderPlanned = true;
                            single_queue.insertIntoQueueAndUpdate(order, index2)
                            return single_queue;
                        }
                        break;
                    }

                }
            }
            if (!orderPlanned && single_queue.queue[single_queue.queue.length - 1].plannedDate + this.getProdTime(single_queue, order.product) < order.dueDate) //sonderfall: Auftrag noch nicht eingeplant, aber kommt eventuell an das Ende der Schlange
            {

                let planned = single_queue.queue[single_queue.queue.length - 1].plannedDate + this.getProdTime(single_queue, order.product); //planned ist abschluss des letzten elements in der queue + order.duration
                if (planned < order.dueDate)
                { //@todo_aw: prüfen wir das nicht vorher schon?
                    single_queue.insertIntoQueueAndUpdate(order, single_queue.queue.length);
                    return single_queue;
                }
            }
        }
        return null;
    }

    private getProdTime(resource: ResourceH1, product: ProductH1): number
    {
        let prodTime: number = (resource.parent.ProductionTime.get(product.id))!
        return prodTime
    }

    // depth search
    private getMaxFollowingDuration(order: ProductionOrderH1, state: number, iteration: number, MachineGroups: Map<number, ResourceGroupH1>): number
    {
        let max_iterations: number = 10;
        if (iteration > max_iterations)
        {
            MsgLog.log(this, "Achtung: Maximale Anzahl Iterationen überschritten: Skillmap auf Schleifen prüfen!", this, true, true)
            return -1

        }
        let max_following_duration: number = 0;
        let ways = order.product.routeSheet.map.get(state);
        //let waysleft:boolean = false;
        ways?.forEach((way_element) =>
        {
            if (way_element.nextState != -1)
            {
                //waysleft = true;
                let next_state_duration = this.getMaxDurationForState(order, way_element.nextState, MachineGroups);
                let following_state_duration = this.getMaxFollowingDuration(order, way_element.nextState, iteration + 1, MachineGroups)
                let maxpathlength = next_state_duration + following_state_duration;
                if (max_following_duration < maxpathlength)
                {
                    max_following_duration = maxpathlength;
                }
            }
        });
        return max_following_duration
    }

    private findBestSlotForOrderAndInsert(sort: ResourceH1[], order: ProductionOrderH1, MachineGroups: Map<number, ResourceGroupH1>): ResourceH1
    {
        sort.sort((MachineA, MachineB) => MachineA.getTotalDurationInQueue() - MachineB.getTotalDurationInQueue()) //Sort queue by utilization

        let best_resource: [ResourceH1, number, number];
        let tmp_resource: [ResourceH1, number, number];
        let single_queue: ResourceH1;
        if (sort.length == 1) //In case there is only one possible machine
        {
            best_resource = this.checkSingleQueueMinDelay(sort[0], order, MachineGroups) //find earliest slot to insert the order into the schedule without violating the due dates of other orders
        }
        else // in case there is more than one machine --> the least utilized resource is spared
        {
            best_resource = this.checkSingleQueueMinDelay(sort[0], order, MachineGroups); // initialize the variable best_resource as the 2nd machine in the sort array --> is updated later if there is a better machine
            for (let index = 0; index < sort.length; index++) // check all other machines if there is a better slot
            {
                single_queue = sort[index];
                tmp_resource = this.checkSingleQueueMinDelay(single_queue, order, MachineGroups);
                if (tmp_resource[2] < best_resource[2])
                {
                    best_resource = tmp_resource;
                }
            }
        }
        best_resource[0].insertIntoQueueAndUpdate(order, best_resource[1])
        return best_resource[0]
    }

    private checkSingleQueueMinDelay(single_queue: ResourceH1, order: ProductionOrderH1, MachineGroups: Map<number, ResourceGroupH1>): [ResourceH1, number, number]
    {
        let queued_order;
        if (single_queue.queue.length != 0)
        {
            for (let index = 0; index < single_queue.queue.length; index++) 
            {
                queued_order = single_queue.queue[index];
                let tempPlan: number;
                if (index == 0)
                {
                    if (single_queue.inMachining != undefined)
                    {
                        tempPlan = single_queue.inMachining.plannedDate + single_queue.parent.ProductionTime.get(order.product.id)!
                    }
                    else
                    {
                        tempPlan = single_queue.parent.sim.time() + single_queue.parent.ProductionTime.get(order.product.id)!
                    }
                }
                else
                {
                    tempPlan = single_queue.queue[index - 1].plannedDate + single_queue.parent.ProductionTime.get(order.product.id)!
                }

                let trigger = true;
                let planned = tempPlan;
                let next_order: ProductionOrderH1;
                for (let index2 = index; index2 < single_queue.queue.length; index2++)
                {
                    next_order = single_queue.queue[index2];
                    planned = planned + single_queue.parent.ProductionTime.get(next_order.product.id)!;
                    let max: number = planned + this.getMaxFollowingDuration(next_order, next_order.status, 1, MachineGroups)
                    if (max > next_order.dueDate) 
                    {
                        trigger = false;
                        break;
                    }
                }
                if (trigger)
                {
                    return [single_queue, index, tempPlan];
                }

            }
            let plannedDate = single_queue.queue[single_queue.queue.length - 1].plannedDate + single_queue.parent.ProductionTime.get(order.product.id)!
            return [single_queue, single_queue.queue.length, plannedDate]
        }
        else
        {
            let plannedDate = 0;
            if (single_queue.inMachining != undefined)
            {
                plannedDate = single_queue.inMachining.plannedDate + single_queue.parent.ProductionTime.get(order.product.id)!
            }
            else
            {
                plannedDate = single_queue.parent.sim.time() + single_queue.getProdTime(order)
            }
            return [single_queue, single_queue.queue.length, plannedDate]
        }

    }
}