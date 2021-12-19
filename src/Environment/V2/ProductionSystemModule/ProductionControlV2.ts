/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import ICustomerOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/ICustomerOrder";
import MsgLog from "../../../SystemManagement/MessengingSystem/MsgLog";
import ResourceV2 from "./ResourceV2";
import OrderV2 from "./OrderV2";


export default class ProductionControlV2
{
    /**
     * Estimates the shortest completion time for an order and a given amount of machines
     * @param machines 
     * @param order 
     * @returns 
     */
    estimateShortestCompletionTime(machines: ResourceV2[], order: OrderV2): number
    {
        let temp = order.dueDate; // save duedate for more robust solution
        order.dueDate = 0; //setze null um kürzeste Zeit zu bekommen
        let shortestTime = this.findSlotMinDelay(machines, order)[2]; //an 3-1 Position ist das plannedDate!        
        order.dueDate = temp;
        return shortestTime;
    }

    /**
     * Plans an order into an amount of machines based on the minimum slack rule
     * @param machines 
     * @param order 
     * @returns 
     */
    planOrder(machines: ResourceV2[], order: OrderV2): ResourceV2
    {
        let result = this.findSlotForOrder(machines, order)
        result[0].insertIntoQueueAndUpdate(order, result[1]);

        result[0].flagUsed = true;
        result[0].flagUsedKPI = true;

        return result[0];
    }

    private findSlotForOrder(sort: ResourceV2[], order: OrderV2): [ResourceV2, number]
    {
        let chosenCapa: ResourceV2 | null = null;
        let qIndex = -1;
        //1. Find the second most unused machine
        //2.1. Sort order into queue and check if order can be produced in time
        //2.2. if not, got to the next machine with longer queue and test there
        //2.3 check for all following orders to be in time, if not go to 2.2, else finish
        //3. if order is not planned yet use most unused machine an force plan it into that queue

        //Sort queue by capacity
        sort.sort((MachineA, MachineB) => MachineA.getTotalDurationInQueue() - MachineB.getTotalDurationInQueue());

        if (sort.length == 1)// Es gibt nur eine Machine, dann muss das da rein
        {
            chosenCapa = sort[0];

            MsgLog.log(MsgLog.types.debug, "Only one machine| name: " + sort[0].parent.name, this, false, true)
            qIndex = this.checkSingleQueueNoDelay(sort[0], order)[1];
            if (qIndex == -1)
            {
                qIndex = this.checkSingleQueueMinDelay(sort[0], order)[1];
            }
        }
        else
        {

            [chosenCapa, qIndex] = this.findSlotNoDelay(sort, order);
            if (chosenCapa == null)
            {
                let plannedDate = 0;
                [chosenCapa, qIndex, plannedDate] = this.findSlotMinDelay(sort, order);
            }
        }


        MsgLog.log(MsgLog.types.debug, "Chosen machine name: " + chosenCapa!.parent.name + " machine ID: (" + chosenCapa!.machineID + ") total duration: " + chosenCapa!.getTotalDurationInQueue(), this, false, false)
        return [chosenCapa!, qIndex];
    }

    private findSlotMinDelay(sort: ResourceV2[], order: OrderV2): [ResourceV2, number, number]
    {
        let chosenCapa: ResourceV2 | null = null;
        let qIndex = -1;
        let tempCapa: ResourceV2, tempqIndex: number, plannedDate: number = 0, tempPlannedDate: number = 0;
        for (let index = 0; index < sort.length; index++) //alles Maschinen dieses Mal
        {
            const single_queue = sort[index];
            //s. Schritt 2.1
            [tempCapa, tempqIndex, tempPlannedDate] = this.checkSingleQueueMinDelay(single_queue, order);
            if (chosenCapa == null || tempPlannedDate < plannedDate)
            {
                chosenCapa = tempCapa;
                qIndex = tempqIndex;
                plannedDate = tempPlannedDate;
            }
        }

        return [chosenCapa!, qIndex, plannedDate];
    }

    private findSlotNoDelay(sort: ResourceV2[], order: OrderV2): [ResourceV2, number]
    {
        let chosenCapa: ResourceV2 | null = null;
        let qIndex = -1;
        for (let index = 1; index < sort.length; index++)
        {
            const single_queue = sort[index];
            //s. Schritt 2.1

            [chosenCapa, qIndex] = this.checkSingleQueueNoDelay(single_queue, order);
            if (chosenCapa != null)
            {
                break;
            };

        }

        if (chosenCapa == null)//Sonderfall alle Maschinen ausgelastet, nutze die "geschonte" Maschine beim index = 0, falls möglich
        {
            [chosenCapa, qIndex] = this.checkSingleQueueNoDelay(sort[0], order);
        }

        return [chosenCapa!, qIndex];
    }

    private checkSingleQueueMinDelay(single_queue: ResourceV2, order: OrderV2): [ResourceV2, number, number]
    {
        let queued_order;
        let next_order;
        if (single_queue.queue.length != 0)
        {
            for (let index = 0; index < single_queue.queue.length; index++) //suche die Stelle in dieser Schlange, an der einsortiert werden sollte
            {

                queued_order = single_queue.queue[index];
                let tempPlan: number;
                if (index == 0)
                {

                    if (single_queue.inMachining != undefined)
                    {
                        tempPlan = single_queue.inMachining.plannedDate + single_queue.getProdTime(order)
                    }
                    else
                    {
                        tempPlan = single_queue.parent.sim.time() + single_queue.getProdTime(order)
                    }
                }
                else //Nur wenn es min. einen Vorgänger gibt
                {
                    //Schau dir Eintrag vor dem betrachteten an, das ist der Vorgänger
                    tempPlan = single_queue.queue[index - 1].plannedDate + single_queue.getProdTime(order)
                }


                //Prüfe, ob einschieben okay ist für alle nachfolgenden order in der queue
                let trigger = true;
                let planned = tempPlan; //Summierer, der in jeder Iterationschleife das Ende des vorherigen Auftrags anzeigt

                for (let index2 = index; index2 < single_queue.queue.length; index2++)
                {
                    next_order = single_queue.queue[index2];
                    planned = planned + next_order.duration;
                    if (planned > next_order.dueDate)
                    {
                        trigger = false; //Verletzung einer Verspätungsbedingung, setze trigger auf false, sodass einschieben verhindert wird
                        break; //brich prüfung ab bzw. verlasse diese for schleife, wenn ein order due Date verletzt ist
                    }
                }
                if (trigger)//Wenn trigger, dann war für alle nachfolgenden order okay, also einschieben und updaten
                {
                    return [single_queue, index, tempPlan - (single_queue.parent.sim.time() + single_queue.getProdTime(order))];
                }
            }
            let plannedDate = single_queue.queue[single_queue.queue.length - 1].plannedDate + single_queue.getProdTime(order);
            return [single_queue, single_queue.queue.length, plannedDate - (single_queue.parent.sim.time() + single_queue.getProdTime(order))]
        }
        else
        {
            let plannedDate = 0;
            if (single_queue.inMachining != undefined)
            {
                plannedDate = single_queue.inMachining.plannedDate + single_queue.getProdTime(order)
            }
            else
            {
                plannedDate = single_queue.parent.sim.time() + single_queue.getProdTime(order)
            }
            return [single_queue, single_queue.queue.length, plannedDate - (single_queue.parent.sim.time() + single_queue.getProdTime(order))]
        }

    }

    private checkSingleQueueNoDelay(single_queue: ResourceV2, order: OrderV2): [ResourceV2 | null, number]
    {
        let orderPlanned = false;
        if (single_queue.queue.length == 0) //Wenn queue leer ist, dann kann die Order direkt eingefügt werden 
        {

            let plannedDate = 0;
            if (single_queue.inMachining != undefined)
            {
                plannedDate = single_queue.inMachining.plannedDate + single_queue.getProdTime(order)
            }
            else
            {
                plannedDate = single_queue.parent.sim.time() + single_queue.getProdTime(order)
            }
            if (plannedDate < order.dueDate)
            {
                return [single_queue, 0];
            } else
            {
                return [null, -1];
            }

        }
        else
        {
            for (let index2 = 0; index2 < single_queue.queue.length; index2++) //suche die Stelle in dieser Schlange, an der einsortiert werden sollte
            {
                const queued_order = single_queue.queue[index2];
                if (queued_order.dueDate > order.dueDate) //Stelle gefunden, wo eingefügt werden muss
                {
                    let tempPlan

                    //Temporärer Zeitplan für order, wird gleich aktualisiertm wenn es einen Vorgänger in der queue gibt
                    if (index2 != 0) //Nur wenn es min. einen Vorgänger gibt
                    {
                        //Schau dir Eintrag vor dem betrachteten an, das ist der Vorgänger
                        tempPlan = single_queue.queue[index2 - 1].plannedDate + single_queue.getProdTime(order); //Produktionsendzeit des Vorgängers + Dauer des neuen Auftrags
                    } else
                    {
                        if (single_queue.inMachining != undefined)
                        {
                            tempPlan = single_queue.inMachining.plannedDate + single_queue.getProdTime(order)
                        }
                        else
                        {
                            tempPlan = single_queue.parent.sim.time() + single_queue.getProdTime(order)
                        }
                    }

                    if (tempPlan < order.dueDate) //Ist dieser temporäre Zeitplan für den aktuellen Auftrag okay?
                    {
                        //Prüfe, ob einschieben okay ist für alle nachfolgenden order in der queue
                        let trigger = true;
                        let planned = tempPlan; //Summierer, der in jeder Iterationschleife das Ende des vorherigen Auftrags anzeigt
                        for (let index3 = index2; index3 < single_queue.queue.length; index3++)
                        {
                            const next_order = single_queue.queue[index3];
                            if (planned + next_order.duration > next_order.dueDate)
                            {
                                trigger = false; //Verletzung einer Verspätungsbedingung, setze trigger auf false, sodass einschieben verhindert wird
                                break; //brich prüfung ab bzw. verlasse diese for schleife, wenn ein order due Date verletzt ist
                            }
                            planned = planned + next_order.duration; //Setze den Zeiger nun auf das virtuelle Ende des next_order für den darauf folgenden next_order                                     

                        }
                        if (trigger)//Wenn trigger, dann war für alle nachfolgenden order okay, also einschieben und updaten
                        {
                            orderPlanned = true; //order konnte eingeplant werden
                            //single_queue.insertIntoQueueAndUpdate(order, index2)
                            return [single_queue, index2];
                        }
                        break;
                    }

                }
            }
            if (!orderPlanned && single_queue.queue[single_queue.queue.length - 1].plannedDate + single_queue.getProdTime(order) < order.dueDate) //sonderfall: Auftrag noch nicht eingeplant, aber kommt eventuell an das Ende der Schlange
            {

                let planned = single_queue.queue[single_queue.queue.length - 1].plannedDate + single_queue.getProdTime(order); //planned ist abschluss des letzten elements in der queue + order.duration
                if (planned < order.dueDate)
                {
                    //single_queue.insertIntoQueueAndUpdate(order, single_queue.queue.length);
                    return [single_queue, single_queue.queue.length];
                }
            }
        }
        return [null, -1];
    }
}