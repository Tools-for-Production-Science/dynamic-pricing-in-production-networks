/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { Sim } from "simts";
import ResourceV2 from "./ResourceV2";

export class ResourceGroupV2
{
    name: string = "";    
    sim: Sim;
    ressourceGroupInvestCost: number;
    Machines = new Array<ResourceV2>();
    MachineProductionRatePerPart = new Map<number, number>(); //Map<PartID,ProductionRate>
    RevenueRatePerUnitMap = new Map<number, number>(); //Map<PartID, RevenuePerPart>

    /**
     * This is a group of resources e.g. stations, machines or similar
     * @param name name of the group
     * @param sim reference to the sim object
     * @param ressourceGroupInvestCost basic cost of an entity of this group
     */
    constructor(name: string, sim: Sim, ressourceGroupInvestCost: number)
    {
        this.name = name;
        this.sim = sim;
        this.ressourceGroupInvestCost = ressourceGroupInvestCost;
    }

    /**
     * Adds a new machine to the group
     * @param id the id of the machine
     */
    addMachine(id: number)
    {
        this.Machines.push(new ResourceV2(this, id));
    }
}