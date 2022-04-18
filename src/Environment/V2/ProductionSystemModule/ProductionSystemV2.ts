/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer (First version)

Copyright (c) 2021 Festo SE & Co. KG 

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { ISimEntity, Random, Sim, SimEntity } from "simts";
import { ResourceGroupV2 } from "./ResourceGroupV2";
import { col } from "../../../SystemManagement/Configuration/DataformatEnum";
import { EngineV2 } from "../EngineV2";
import { PossMaschinesV2 } from "./PossMaschinesV2";
import { EnvironmentConfiguration } from "../../../SystemManagement/Configuration/EnvironmentConfiguration";
import MsgLog from "../../../SystemManagement/MessengingSystem/MsgLog";
import OrderV2 from "./OrderV2";
import ResourceV2 from "./ResourceV2";
import ProductionControlV2 from "./ProductionControlV2";
import { Analytics } from "../../../SystemManagement/Analytics/Analytics";
import IEnvironmentComponent from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IEnvironmentComponent";
import IProductionSystem from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProductionSystem";
import IDemand from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IDemand";
import ICustomerOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/ICustomerOrder";
import DataStream from "../../../SystemManagement/Analytics/DataStream";


export class ProductionSystemV2 extends SimEntity implements IEnvironmentComponent, IProductionSystem
{
    revenueMachineSavedArray = new Array<number>();
    pc = new ProductionControlV2();
    sim: Sim;

    unusedMachineReport;
    earlinessAndTardinessReports;

    public repDelays: DataStream;
    private repEarliness: DataStream;
    private repTardiness: DataStream;
    private repCumulativeDeviation: DataStream;

    public repFinishedDelays: DataStream;
    private repFinishedEarliness: DataStream;
    private repFinishedTardiness: DataStream;
    private repFinishedCumulativeDeviation: DataStream;

    private reportUnusedMachines: DataStream;

    private machineUtilizationReports;
    private machineUtilizationReportArray: Array<DataStream>;

    private machineID: number = -1;

    //variable for summing up the tardiness and earliness
    private cumulativePlannedDeviation = 0;
    private cumulativeFinishedDeviation = 0;

    allResourceTypes: String[] = []; //FS:Das hier gehört besser in ProductionSystem
    allResourceNames: String[] = [];
    allResourceIds: number[] = [];

    rawKPIs!: DataStream;
    kpiID = 0;

    engine: EngineV2;
    config: EnvironmentConfiguration;

    finishedOrdersOfADay: Array<OrderV2> = new Array<OrderV2>();

    sites = new Map<number, Map<string, ResourceGroupV2>>();
    skillMap: Map<number, Map<number, PossMaschinesV2>> = new Map<number, Map<number, PossMaschinesV2>>();


    sort = new Array<ResourceV2>(); //performance reasons

    maxFinishedTardiness: number = 0;
    maxFinishedEarliness: number = 0;
    maxPlannedTardiness: number = 0;
    maxFinishedDelays: number = 0;
    maxPlannedEarliness: number = 0;

    maxShortestCompletionTime: number = 0;

    /**
     * The production system is a central component besides the production network. It represents a complete site. It handles all processes releveant to a site, like resources, production control, manufacturing etc.
     * @param engine the engine which created this production system entity
     */
    constructor(engine: EngineV2)
    {
        super();
        this.engine = engine;

        this.config = engine.config.envConfig;
        this.sim = engine.sim;
        this.unusedMachineReport = this.engine.analytics.createNewReport("Report für unbenutzte Maschinen");
        this.earlinessAndTardinessReports = this.engine.analytics.createNewReport("Reports für Frühzeitigkeit und Verspätung");

        this.repDelays = (this.engine.analytics as Analytics).createVisualisationWriter("Anzahl der geplanten Verspätungen", "line", this.earlinessAndTardinessReports)
        this.repEarliness = (this.engine.analytics as Analytics).createVisualisationWriter("Frühzeitigkeit (geplant)", "line", this.earlinessAndTardinessReports)
        this.repTardiness = (this.engine.analytics as Analytics).createVisualisationWriter("Verspätung (geplant)", "line", this.earlinessAndTardinessReports)
        this.repCumulativeDeviation = (this.engine.analytics as Analytics).createVisualisationWriter("Kumulative Abweichung vom geplanten Lieferzeitpunkt (geplant)", "line", this.earlinessAndTardinessReports)
        this.reportUnusedMachines = (this.engine.analytics as Analytics).createVisualisationWriter("Unbenutzte Maschinen", "line", this.unusedMachineReport)

        this.repFinishedDelays = (this.engine.analytics as Analytics).createVisualisationWriter("Anzahl der abgeschlossenen Verspätungen", "line", this.earlinessAndTardinessReports)
        this.repFinishedEarliness = (this.engine.analytics as Analytics).createVisualisationWriter("Frühzeitigkeit (abgeschlossen)", "line", this.earlinessAndTardinessReports)
        this.repFinishedTardiness = (this.engine.analytics as Analytics).createVisualisationWriter("Verspätung (abgeschlossen)", "line", this.earlinessAndTardinessReports)
        this.repFinishedCumulativeDeviation = (this.engine.analytics as Analytics).createVisualisationWriter("Kumulative Abweichung vom geplanten Lieferzeitpunkt (abgeschlossen)", "line", this.earlinessAndTardinessReports)

        this.rawKPIs = this.engine.analytics.createDataStreamWriter("KPIs");

        this.machineUtilizationReports = this.engine.analytics.createNewReport("Planungsschlupf je Maschine")
        this.machineUtilizationReportArray = new Array<DataStream>(this.allResourceNames.length);
        for (let i = 0; i < this.machineUtilizationReportArray.length; i++)
        {
            this.machineUtilizationReportArray[i] = this.engine.analytics.createVisualisationWriter("Planungsschlupf (Median) auf Maschine " + i, "line", this.machineUtilizationReports)
        }
    }
/**
 * Entry point for an order. When order is given it will be planned produced and delivered
 * @param order the order to handle
 */
    plan(order: OrderV2)
    {
        let machinelist = new Array<String>();
        this.skillMap.get(order.product.id)?.forEach(machine =>
        {
            if (machine.historic[0] != "")
            { //Check if there is no historic machine for this product
                machinelist = machinelist.concat(machine.historic);
            }
            if (machine.recommended[0] != "")
            { //Check if there is no recommended machine for this product
                machinelist = machinelist.concat(machine.recommended);
            }
            return machinelist;

        });

        this.planOrder(order, machinelist);
    }

    /**
     * Standardized function to create an empty order given a standardized demand; this is necessary to interact with the general production network
     */
    createOrderTemplate(demand: IDemand): ICustomerOrder
    {
        let amount = Math.ceil(demand.drawQuantity());
        let order = new OrderV2(amount, demand.product[0], this.sim.simTime)

        if (amount == 0)
        {
            order.notOrderedByCustomer = true;
        }
        return order;
    }


    start()
    {
        MsgLog.log(MsgLog.types.debug, "Manufacturing was called", this, false, true);
    }

    /**
     * Helper function to register some time based functions
     */
    registerTimeBasedEvents()
    {
        (this as unknown as ISimEntity).setTimer(this.config.totalSimTime).done(this.pushAllRemainingPlannedOrdersInDB, this);
        (this as unknown as ISimEntity).setTimer(this.config.totalSimTime * this.config.startOfBenchmarkTest).done(this.clearMachines, this);
    }


    /**
     * Relevant for site specific production execution. It takes a list of machines allowed to produce a product. There it tries to maximize machien utility
     * @param order the event to execute
     * @param machineList the list of machines to select from
     */
    private planOrder(order: OrderV2, machineList)
    {
        let chosenCapa: ResourceV2 | undefined;
        try
        {
            this.aggregateAllPossibleQueues(machineList); //works with the global sort object and puts result in there! This.sort is a list of all possible machines overall machinegroups

            MsgLog.log(MsgLog.types.debug, "ST: " + this.sim.simTime + " M: " + order.product.id + " DD: " + order.dueDate, this, false, true);
            chosenCapa = this.pc.planOrder(this.sort, order) as ResourceV2; //using the global sort object, returns the chosen machine (one specific)            
            this.triggerMachine(chosenCapa);
        }
        catch (ex)
        {
            this.engine.analytics?.log(MsgLog.types.error, ex, this, false, true);
        }
    }

    /**
     * sets the this.sort object with a list with all machines over all machine groups.
     * @param machineList 
     */
    private aggregateAllPossibleQueues(machineList)
    {
        let aggregatedQueues = new Array<ResourceGroupV2>();
        this.sort.length = 0;

        machineList.forEach(element =>
        {
            this.sites.forEach((site) =>
            {
                let tempMach = site.get(element);
                if (tempMach)
                {

                    aggregatedQueues.push(tempMach);
                }
            })
        });

        if (aggregatedQueues.length == 0) //Todo: keine Käufe, wenn es nur um Knappheit geht
        {
            //chosenCapa.push(this.buyingProcess.BuyMachineCapacityShortage(order.product.id, machineList, siteList)!)
        }

        if (aggregatedQueues.length == 0)
        {
            throw "Error: Keine passende Maschine gefunden!";
        }

        aggregatedQueues.forEach((ele) =>
        {
            this.sort.push(...ele.Machines); //Saves all machines of the possible machineGroups in an array
        });
    }

    /**
     * Triggers a machine, when the queue is not empty and the server is not busy
     * @param que the machine that should be triggered
     */
    private triggerMachine(que: ResourceV2)
    {
        if (que.inMachining == undefined && que.queue.length != 0)
        {
            this.enterfacility(que);
        }
    }

    /**
    * This function works on the queue (machine specific) until every order in the queue is processed
    * @param minutes the number of minutes the machine should be booked
    * @param num the machine number of the type
    */
    private enterfacility(que: ResourceV2)
    {
        let tempTime = this.sim.time();

        let order = que.queue.shift();
        que.inMachining = order;

        if (order != undefined)
        {
            que.inMachining!.productionStart = tempTime;
            (this as unknown as ISimEntity).setTimer(order.duration).done(() =>
            {
                if (que.inMachining)
                {
                    let simTimeNow = this.sim.time();
                    //save the arrival and leave time of each order
                    que.inMachining!.productionStart = tempTime;
                    que.inMachining!.productionEnd = simTimeNow;
                    que.setRevenue(que.inMachining!, this.config)
                    this.writeKPIsToReport(que.inMachining!);
                    this.finishedOrdersOfADay.push(que.inMachining!);
                    que.inMachining = undefined;
                }

                if (que.queue.length)
                {
                    this.triggerMachine(que);
                }
            });
        }

    }

    /**
    * This function adds a facility to a site. If site does not exists, it is created. If workplace does not exist it is created. Otherwise capacity of workplace is increased
    * @param sim the Simulation object
    * @param site string name of site
    * @param typeName string name of workplace
    */
    addFacility(sim, site: string, typeName: string, ressourceGroupInvestitionCost: number)
    {
        this.machineID++;

        let machineGroups = this.sites.get((site as any) * 1);
        if (machineGroups) //if site already exists
        {
            let wp = machineGroups.get(typeName); //Workplace = WorkcenterType
            if (wp) //IF maschinetype already exists, just add one as a free ressource
            {
                wp.addMachine(this.machineID);

                MsgLog.log(MsgLog.types.debug, "Added Capacity to already existing: " + typeName + " for site " + site + " machine ID: " + this.machineID, this, false, false);
            }
            else //If machinetype does not exist, create one
            {
                let machineGroup = this.createGroupAndFirstMachine(sim, typeName, this.machineID, ressourceGroupInvestitionCost);
                machineGroups.set(typeName, machineGroup);
                MsgLog.log(MsgLog.types.debug, "Facility created: " + typeName + " for site " + site + " machine ID: " + this.machineID, this, false, false);
                //console.log("Facility created: " + workplace + " for site " + site);
            }
        }
        else //if site doesnt exits create one and add the ressource
        {
            let machineGroup = this.createGroupAndFirstMachine(sim, typeName, this.machineID, ressourceGroupInvestitionCost);
            let site = new Map<string, ResourceGroupV2>();
            site.set(typeName, machineGroup);
            this.sites.set((site as any) * 1, site);
            MsgLog.log(MsgLog.types.debug, "Group created: " + typeName + " for newly created site " + site + " machine ID: " + this.machineID, this, false, false);
        }
    }

    /**
     * Helper function; creates a group for a machine and adds the machine to it
     * @param sim reference to simobject
     * @param typeName name of the group
     * @param machineID id of the machines
     * @param ressourceGroupInvestCost invest cost for a machine of this types
     * @returns 
     */
    private createGroupAndFirstMachine(sim, typeName, machineID, ressourceGroupInvestCost: number)
    {
        let temp = new ResourceGroupV2(typeName, sim, ressourceGroupInvestCost, this.engine.randomSIM);
        temp.addMachine(machineID);
        return temp;
    }

    /**
     * Adds a mapping between a product and possible machines
     * @param line of the csv file as an array
     */
    addToSkillmap(line)
    {
        let pID = line[col.skillPartID] * 1;

        let p = new PossMaschinesV2();
        p.loadHistoricFromString(line[col.skillWType]);
        p.loadRecommendedFromString(line[col.skillRec]);

        if (!this.skillMap.get(pID))
        {
            let tempMap = new Map<number, PossMaschinesV2>();
            tempMap.set(line[col.skillSite] * 1, p);
            this.skillMap.set(pID, tempMap);
        }
        else
        {
            this.skillMap.get(pID)?.set(line[col.skillSite] * 1, p); //
        }
    }

    /**
     * function for calculating the reward from manufacturing point of view
     * @returns returns the calculated reward from manufacturing
     */
    calculateReward(): number
    {

        let reward = 0;
        let rewardingIndicators = this.getRewardParametersPlannedOrders()
        let unusedMachines = rewardingIndicators[3] / (this.allResourceIds.length);
        let delaysSum = rewardingIndicators[2];
        let earlinessSum = rewardingIndicators[1];
        let tardinessSum = rewardingIndicators[0];
        this.cumulativePlannedDeviation += (earlinessSum + tardinessSum);

        MsgLog.log(MsgLog.types.debug, 'unused machines ' + unusedMachines, this)
        MsgLog.log(MsgLog.types.debug, 'delays sum ' + delaysSum, this)
        MsgLog.log(MsgLog.types.debug, 'earliness sum ' + earlinessSum, this)
        MsgLog.log(MsgLog.types.debug, 'tardiness sum ' + tardinessSum, this)

        //if order was null, give no reward
        if ((this.engine.productionNetwork.lastOrder?.notOrderedByCustomer == false))
        {


            //interpretation: contract penalty
            if ((((this.engine.productionNetwork.lastOrder as OrderV2).plannedDate) - (this.engine.productionNetwork.lastOrder as OrderV2).dueDate) > 0)
            {
                let plannedTardiness = (((this.engine.productionNetwork.lastOrder as OrderV2).plannedDate) - (this.engine.productionNetwork.lastOrder as OrderV2).dueDate)
                plannedTardiness = this.normalizeValue(plannedTardiness, 'maxPlannedTardiness');
                reward -= this.config.tardinessPenalty * plannedTardiness
            }

            if ((((this.engine.productionNetwork.lastOrder as OrderV2).plannedDate) - (this.engine.productionNetwork.lastOrder as OrderV2).dueDate) < 0)
            {
                let plannedEarliness = Math.abs((((this.engine.productionNetwork.lastOrder as OrderV2).plannedDate) - (this.engine.productionNetwork.lastOrder as OrderV2).dueDate))
                plannedEarliness = this.normalizeValue(plannedEarliness, 'maxPlannedEarliness');
                reward -= this.config.earlinessPenalty * plannedEarliness
            }
        }

        //only reward production levelling end unused at the end of a planning horizon
        if (this.engine.productionNetwork.lastIteration)
        {

            let finishedOrdersReward = this.getRewardParametersFinishedOrders();
            let finishedDelays = finishedOrdersReward[0];
            let finishedTardiness = finishedOrdersReward[1];
            let finishedEarliness = finishedOrdersReward[2];
            this.cumulativeFinishedDeviation += finishedTardiness + finishedEarliness

            this.repFinishedDelays.write(this.engine.productionNetwork.counterRunDemandOrders, finishedDelays);
            this.repFinishedTardiness.write(this.engine.productionNetwork.counterRunDemandOrders, finishedTardiness);
            this.repFinishedEarliness.write(this.engine.productionNetwork.counterRunDemandOrders, finishedEarliness);
            this.repFinishedCumulativeDeviation.write(this.engine.productionNetwork.counterRunDemandOrders, this.cumulativeFinishedDeviation);

            finishedDelays = this.normalizeValue(finishedDelays, 'maxFinishedDelays')
            finishedTardiness = this.normalizeValue(finishedTardiness, 'maxFinishedTardiness')
            finishedEarliness = this.normalizeValue(finishedEarliness, 'maxFinishedEarliness')

        }

        //plot the count of delayed orders (number of tardy jobs)
        this.repDelays.write(this.engine.productionNetwork.counterRunDemandOrders, delaysSum);

        //plot the earliness sum
        this.repEarliness.write(this.engine.productionNetwork.counterRunDemandOrders, earlinessSum);

        //plot the tardiness sum
        this.repTardiness.write(this.engine.productionNetwork.counterRunDemandOrders, tardinessSum);

        this.repCumulativeDeviation.write(this.engine.productionNetwork.counterRunDemandOrders, this.cumulativePlannedDeviation);

        //create report for unused machines here
        this.reportUnusedMachines.write(this.sim.simTiming.getCurrentDate(), unusedMachines);

        MsgLog.log(MsgLog.types.debug, 'penalty from manufacturing is ' + reward, this)
        MsgLog.log(MsgLog.types.debug, 'reward in manufacturing calculated correctly ', this)

        return reward;
    }

    /**
     * returns the count of delays, tardiness and earliness (in that order) for a given day as an array
     */
    private getRewardParametersFinishedOrders()
    {
        let delays = 0;
        let tardiness = 0;
        let earliness = 0;

        for (let i = 0; i < this.finishedOrdersOfADay.length; i++)
        {
            let res = (this.finishedOrdersOfADay[i].productionEnd - this.finishedOrdersOfADay[i].dueDate)
            if (res > 0)
            {
                delays += 1;
                tardiness += res;
            } else
            {
                earliness += Math.abs(res);
            }
        }

        this.finishedOrdersOfADay = [];

        return [delays, tardiness, earliness]

    }

    /**
     * function that calculates the parameters for calculating the reward
     * @returns returns an array with [tardinessSum, earlinessSum, delaysSum, unusedMachines]
     */
    private getRewardParametersPlannedOrders(): number[]
    {

        let delaysSum = 0;
        let unusedMachines = 0;

        let earlinessSum = 0;
        let tardinessSum = 0;

        //use the facility object to iterate over all machines - cannot be implemented in machines as there is no access to the facility
        this.sites.forEach((mapMachineGroup, plantID) =>
        {
            mapMachineGroup.forEach((machineGroup, machineGroupName) =>
            {
                machineGroup.Machines.forEach((machine) =>
                {
                    //count the number of tardy jobs
                    delaysSum += machine.plannedDelays();
                    tardinessSum += machine.calcDeviationFromPlanned(true);
                    earlinessSum += machine.calcDeviationFromPlanned(false);
                    if (!machine.flagUsed)
                    {
                        //count the number of unused machines
                        unusedMachines += 1;
                    }

                })
            })
        })
        return [tardinessSum, earlinessSum, delaysSum, unusedMachines]
    }

    /**
     * 
     * @returns the number of currently unused resources/machines/stations
     */
    private getUnusedMachinesKPI(): number
    {
        let unusedMachinesKPI = 0


        //use the facility object to iterate over all machines - cannot be implemented in machines as there is no access to the facility
        this.sites.forEach((mapMachineGroup, plantID) =>
        {
            mapMachineGroup.forEach((machineGroup, machineGroupName) =>
            {
                machineGroup.Machines.forEach((machine) =>
                {

                    if (!machine.flagUsedKPI)
                    {
                        //count the number of unused machines
                        unusedMachinesKPI += 1;
                    }
                })
            })
        })
        return unusedMachinesKPI
    }

    /**
     * 
     * @returns the shortest time possible given the current state of the production system to finish an order
     */
    private getShortestCompletionTime(): number
    {
        let machinelist = new Array<String>();
        this.skillMap.get((this.engine.productionNetwork.curOrder as OrderV2).product.id)?.forEach(machine =>
        {
            if (machine.historic[0] != "")
            { //Check if there is no historic machine for this product
                machinelist = machinelist.concat(machine.historic);
            }
            if (machine.recommended[0] != "")
            { //Check if there is no recommended machine for this product
                machinelist = machinelist.concat(machine.recommended);
            }
            return machinelist;
        });

        this.aggregateAllPossibleQueues(machinelist); //überührt string array in maschinenObjekte array und spoeichert in this.sort...
        let time = this.pc.estimateShortestCompletionTime(this.sort, this.engine.productionNetwork.curOrder as OrderV2);

 
        let value = 0;
        if (time > 0)
        {
            value = (time / (this.engine.sim.simTiming.getInBaseTime(30, "days")))            
        }

        return value;
    }

    /**
     * function for getting the state for KI
     * @returns 
     */
    getStateFunctions(): [Array<() => number | number[]>, number]
    {
        let res = new Array<() => number | number[]>();
        let states: number = 0;


        res.push(() => { return this.getShortestCompletionTime() });
        states += 1;
        return [res, states];
    }

    /**
     * Resets all "used" flags of machines. Also, it adds a saving value for unused machines
     * @param resetOfMachines 
     */
    resetMachineFlagsKPI(resetOfMachines: boolean = true)
    {
        let revenueMachineSaved = 0
        //if a specified time frame is over, iterate through all machines and reset the flags

        this.sites.forEach((mapMachineGroup, plantID) =>
        {
            mapMachineGroup.forEach((machineGroup, machineGroupName) =>
            {
                machineGroup.Machines.forEach((machine) =>
                {
                    if (machine.flagUsedKPI == false)
                    {
                        revenueMachineSaved = revenueMachineSaved + machineGroup.ressourceGroupInvestCost
                    }
                    machine.flagUsedKPI = false;

                })
            })
        })
        if (!resetOfMachines)
        {
            this.revenueMachineSavedArray.push(revenueMachineSaved);
        } else
        {
            this.revenueMachineSavedArray = [];
        }

    }

    /**
     * Add the speed of production for a specific part on a specific machine
     * @param line a line of the csv file
     */
    addToProductionRateMap(line)
    {

        let ressourceType = line[col.prWorkcenterType];
        let PartID = line[col.prPart] * 1;
        let ProductionRate = line[col.prProductionRate] * 1;

        this.sites.forEach((site) =>
        {
            let rT = site.get(ressourceType)
            if (rT)
            {
                rT.MachineProductionRatePerPart.set(PartID, ProductionRate)

            }
        })

    }

    /**
     * Add base revenue of a part to a machine/station/resource
     * @param line a line of the csv file
     */
    addToRevenuePerPart(line)
    {
        let PartID = line[col.RPPpartID] * 1;
        let site = line[col.RPPSite] * 1;

        let RevenueRatePerUnit = line[col.RPPRevenue] * 1;
        this.sites.get(site)?.forEach(machineGroup =>
        {
            machineGroup.RevenueRatePerUnitMap.set(PartID, RevenueRatePerUnit)
        });

    }


    revForV2Optimization = 0
    /**
     * Function which writes a snapshopt to the reporting; Is called once for every order
     * @param order the order which triggers the reporting snapshot
     */
    writeKPIsToReport(order: OrderV2)
    {
        let creationTime

        if (this.sim.time() > this.config.totalSimTime * this.config.startOfBenchmarkTest)
        {
            creationTime = order.timeOfCreation - (this.config.totalSimTime * this.config.startOfBenchmarkTest + this.config.lengthSettlingPhase)
        }


        this.kpiID++;
        this.rawKPIs.write("ID", this.kpiID);
        MsgLog.log(MsgLog.types.debug, 'id ' + this.kpiID, this)

        this.rawKPIs.write("Day", Math.floor(creationTime / this.sim.simTiming.getInBaseTime(1, "days")));
        MsgLog.log(MsgLog.types.debug, 'day ' + Math.floor(order.timeOfCreation / this.sim.simTiming.getInBaseTime(1, "days")), this);

        this.rawKPIs.write("Year", Math.ceil(creationTime / this.sim.simTiming.getInBaseTime(365, "days")));
        MsgLog.log(MsgLog.types.debug, 'year ' + Math.ceil(order.timeOfCreation / this.sim.simTiming.getInBaseTime(365, "days")), this);

        this.rawKPIs.write("Revenue", order.totalRevenue);
        MsgLog.log(MsgLog.types.debug, 'revenue ' + order.totalRevenue, this)

        this.rawKPIs.write("DeclinedOrder", order.notOrderedByCustomer ? 1 : 0);
        MsgLog.log(MsgLog.types.debug, 'declined order ' + (order.notOrderedByCustomer ? 1 : 0), this)

        let deviation = order.plannedDate - order.dueDate
        this.rawKPIs.write("Deviation", Math.abs(deviation));
        MsgLog.log(MsgLog.types.debug, 'deviation  ' + Math.abs(deviation), this)

        this.rawKPIs.write("Delay", (deviation > 0) ? 1 : 0);
        MsgLog.log(MsgLog.types.debug, 'delay ' + ((deviation > 0) ? 1 : 0), this)

        let unusedMachines = this.getUnusedMachinesKPI();
        this.rawKPIs.write("UnusedMachines", unusedMachines);
        MsgLog.log(MsgLog.types.debug, 'unused machines ' + unusedMachines, this)

        this.rawKPIs.write("kiReward", this.engine.productionNetwork.avg);
        //
        if (this.engine.analytics.dbcon.writeToDBCriterion())
            this.revForV2Optimization += order.totalRevenue;
    }

    /**
     * Normalize value to globally given boundaries selected by name
     * @param value value to normalize
     * @param name of parameter to select the process of normalization
     * @returns 
     */
    private normalizeValue(value, name: String)
    {
        let abs = 0;

        if (value > 0)
        {
            abs = Math.abs(value)

            if (name == "maxFinishedDelays")
            {
                if (this.maxFinishedDelays < abs)
                {
                    this.maxFinishedDelays = abs;
                }
                value = value / (this.maxFinishedDelays)
            } else if (name == "maxFinishedEarliness")
            {
                if (this.maxFinishedEarliness < abs)
                {
                    this.maxFinishedEarliness = abs;
                }
                value = value / (this.maxFinishedEarliness)
            } else if (name == "maxFinishedTardiness")
            {
                if (this.maxFinishedTardiness < abs)
                {
                    this.maxFinishedTardiness = abs;
                }
                value = value / (this.maxFinishedTardiness)
            } else if (name == "maxPlannedTardiness")
            {
                if (this.maxPlannedTardiness < abs)
                {
                    this.maxPlannedTardiness = abs;

                } else if (0.9 * this.maxPlannedTardiness > abs)
                {
                    this.maxPlannedTardiness = 0.9 * this.maxPlannedTardiness;
                }
                if (value > 0)
                {
                    value = (value / (this.maxPlannedTardiness))

                }

            } else if (name == "maxPlannedEarliness")
            {
                if (this.maxPlannedEarliness < abs)
                {
                    this.maxPlannedEarliness = abs;
                }
                if (value > 0)
                {
                    value = (value / (this.maxPlannedEarliness))
                }

            } else if (name == "maxShortestCompletionTime")
            {
                if (this.maxShortestCompletionTime < abs)
                {
                    this.maxShortestCompletionTime = abs;
                }
                value = value / (this.maxShortestCompletionTime)
            } else
            {
                throw 'no max value implemented for normalization'
            }
        } else
        {
            value = 0
        }

        return value;
    }

    /**
     * Reset all machines to get an initial state again
     */
    private clearMachines()
    {
        this.resetMachineFlagsKPI(true)
        this.sites.forEach((mapMachineGroup, plantID) =>
        {
            mapMachineGroup.forEach((machineGroup, machineGroupName) =>
            {
                machineGroup.Machines.forEach((machine) =>
                {
                    machine.queue = []
                    machine.inMachining = undefined;
                    //inMachining wird nicht reseted, um useFacility nicht durcheinander zu bringen.

                })
            })

        });

        (this as unknown as ISimEntity).setTimer(this.config.lengthSettlingPhase).done(this.resetMachineFlagsKPI, this);

        if (this.config.useAI == true)
        {
            (this as unknown as ISimEntity).setTimer(this.config.lengthSettlingPhase).done(this.engine.productionNetwork.endEinschwingphase, this.engine.productionNetwork);
        }

        this.config.useAI = false;
    }

    /**
     * add all open oders to db
     */
    pushAllRemainingPlannedOrdersInDB()
    {
        this.sites.forEach((mapMachineGroup, plantID) =>
        {
            mapMachineGroup.forEach((machineGroup, machineGroupName) =>
            {
                machineGroup.Machines.forEach((machine) =>
                {

                    if (machine.inMachining != undefined)
                    {
                        machine.inMachining!.productionEnd = machine.inMachining.plannedDate;
                        machine.setRevenue(machine.inMachining, this.config)
                        this.writeKPIsToReport(machine.inMachining)
                    }
                    machine.queue.forEach(order =>
                    {
                        order.productionEnd = order.plannedDate;
                        machine.setRevenue(order, this.config)
                        this.writeKPIsToReport(order)

                    })

                })
            })

        });
    }
}




