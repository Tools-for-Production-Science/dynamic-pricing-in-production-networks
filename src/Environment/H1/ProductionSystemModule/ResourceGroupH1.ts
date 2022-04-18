/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import Order from "./CustomerOrderH1";
import { Random, Sim } from "simts";
import ResourceH1 from "./ResourceH1";

export class ResourceGroupH1 {
    parallel: boolean;
    minweight: number;
    maxweight: number;
    name: string = "";
    sim: Sim;
    rnd:Random;
    machines = new Array<ResourceH1>();
    sort = new Array<Array<Order>>();
    ProductionTime: Map<number, number>; 
    id:number = -1;

    /**
     * Create a new resourcegroup
     * @param name of the group, e.g. the machine type name
     * @param sim refernece to the sim engine object
     * @param minweight minimum weight the group can process
     * @param maxweight maximum weight the group can process
     * @param parallel wheather products can be processed in parallel (e.g. possible for acclimatization)
     * @param ProductionTime  map to define a production time per product 
     */

    constructor(name: string, sim: Sim, minweight: number, maxweight: number, parallel: boolean, ProductionTime: Map<number, number>, rnd:Random) {
        this.name = name;
        this.sim = sim;
        this.rnd = rnd;
        this.minweight = minweight;
        this.maxweight = maxweight;
        this.parallel = parallel;
        this.ProductionTime = ProductionTime;
    }

    /**
     * Adds a new machine to the group
     * @param id the id of the machine
     */
    
    addMachine(id:number) {
        this.id = id;
        this.machines.push(new ResourceH1(this,id));
    }
}