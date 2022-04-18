/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import RouteSheet from "../../../GenericClasses/GenericSimulationClasses/RouteSheet";
import { ResourceGroupH1 } from "../ProductionSystemModule/ResourceGroupH1";
import IProduct from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProduct";
import MsgLog from "../../../SystemManagement/MessengingSystem/MsgLog";
import { ProductionSystemH1 } from "../ProductionSystemModule/ProductionSystemH1";

export default class ProductH1 implements IProduct
{
    basePrice: number = 0;
    prodTypeStr: string;
    routeSheet: RouteSheet;

    mass: number;
    producttype = "non traffic";
    numCustomers: number = 0;
    id: number = 0;

    // historic Data
    ddDeviations: number[] = [0, 0, 0]; //todo_aw: exp Glättung
    ddDeviation_exp: number = 0;
    prodTimes: number[] = [0, 0, 0];
    prodTimes_exp: number = 0;
    
    /**
     * The specific product for the H1 environment
     * @param prodType only for debugging purposes
     * @param pType the route sheet of the product which describes the path through production
     * @param mass the mass of the product (h1 focuses on high precision weight production)
     * @param id id of the product
     * @param price base price of the product without any negotiation
     * @param prodSys a reference to the production system
     */
    constructor(prodType: string, pType: RouteSheet, mass: number, id: number, price: number)
    {

        this.prodTypeStr = prodType;
        this.mass = mass
        this.routeSheet = pType;
        this.id = id;
        this.basePrice = price;

    }

    /**
     * This function initializes the smoothening which is needed to predict delays
     * @param prodSys reference to the production system
     */
    initializeExpSmoothening(prodSys: ProductionSystemH1)
    {
        let fixedStates: number[] = [100, 200, 600, 700]
        let initialProdDur: number = 0;
        fixedStates.forEach(state =>
        {
            let machines: number[] = this.routeSheet.getMachines(state);
            let max_duration: number = 0;
            machines.forEach((machine) =>
            {
                let mach_duration = prodSys.MachineGroups.get(machine)?.ProductionTime.get(this.id);
                if (mach_duration! > max_duration)
                {
                    max_duration = mach_duration!;
                }
            });
            initialProdDur += max_duration;

        });
        this.prodTimes_exp = initialProdDur;
    }

    /**
     * This function returns all possible machines to manufacture the product given a state
     * @param cur_state the state of the product
     * @param MachineGroups the resource groups which could possibly manufacture the product
     * @returns the ids of machines
     */
    getMachines(cur_state: number, MachineGroups: Map<number, ResourceGroupH1>): number[] 
    {
        let m: number = +this.mass;
        let classpossmachines = this.routeSheet.getMachines(cur_state);
        let possmachines: number[];
        possmachines = []; // needed because push of undefined is not possible
        if (classpossmachines != undefined)
        {
            classpossmachines.forEach((id) =>
            {
                // Abfrage des Bereichs der Maschinen
                let tmp = MachineGroups.get(id);
                if ((tmp != undefined))
                {
                    let max: number = +tmp.maxweight;
                    let min: number = +tmp.minweight;
                    let test: boolean;
                    test = (min <= m);
                    if ((min <= m) && (max >= m))
                    {
                        possmachines.push(id);
                    }
                }

            });
        }

        if (possmachines == [])
        {
            MsgLog.logError("Fehler im Datensatz, keine Maschine gefunden!", this, true, true);
        }
        return possmachines;
    }

    /**
     * updates the smoothening values
     * @param creationTime 
     * @param endTime 
     * @param dueDate 
     */
    processHistoricData(creationTime: number, endTime: number, dueDate: number)
    {
        let ddDeviation = endTime - dueDate; // positive: tardiness, negative: earlyness
        this.ddDeviations.shift();
        this.ddDeviations.push(ddDeviation)
        let prodTime = endTime - creationTime;
        this.prodTimes.shift();
        this.prodTimes.push(prodTime)

        //exp. Glättung hier
        let alpha = 0.7;
        this.ddDeviation_exp = this.ddDeviation_exp * alpha + (1 - alpha) * ddDeviation
        this.prodTimes_exp = this.prodTimes_exp * alpha + (1 - alpha) * prodTime

    }

    /**
     * 
     * @returns the expected time for this product based on historic values
     */
    getExpSmoothing_prodTime()
    {
        return this.prodTimes_exp
    }
    /**
     * 
     * @returns the expected due date devaition given the historic data values
     */
    getExpSmoothing_dueDateDeviation()
    {
        return this.ddDeviation_exp
    }
}