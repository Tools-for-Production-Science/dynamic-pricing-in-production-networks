/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { ISimEntity, Sim, SimEntity } from "simts";
import { EnvironmentConfiguration } from "../../../SystemManagement/Configuration/EnvironmentConfiguration";
import MsgLog from "../../../SystemManagement/MessengingSystem/MsgLog";
import ProductionControlH1 from "./ProductionControlH1";
import { ResourceGroupH1 } from "./ResourceGroupH1";
import ProductH1 from "../ProductionNetworkModule/ProductH1";
import ResourceH1 from "./ResourceH1";
import CustomerOrderH1 from "./CustomerOrderH1";
import { Analytics } from "../../../SystemManagement/Analytics/Analytics";
import RouteSheet from "../../../GenericClasses/GenericSimulationClasses/RouteSheet";
import ICustomerOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/ICustomerOrder";
import IProductionSystem from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProductionSystem";
import EngineH1 from "../EngineH1";
import IDemand from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IDemand";
import DataStream from "../../../SystemManagement/Analytics/DataStream";
import IEnvironmentComponent from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IEnvironmentComponent";
import ProductionOrderH1 from "./ProductionOrderH1";
import DemandH1 from "../ProductionNetworkModule/DemandH1";
import TrafficH1 from "./Traffic";
import IEngine from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IEngine";


export class ProductionSystemH1 extends SimEntity implements IProductionSystem, IEnvironmentComponent
{


    standardStates: number[] = [0, 100, 200, 600, 601, 700];
    skillmap: Map<String, RouteSheet> = new Map<String, RouteSheet>();
    pc = new ProductionControlH1();

    sim: Sim;

    products: ProductH1[] = [];
    engine: IEngine;
    config: EnvironmentConfiguration;

    MachineGroups = new Map<number, ResourceGroupH1>();

    sort = new Array<ResourceH1>();
    analytics: Analytics;

    prodOrderCounter: number = 0;
    customerOrderCounter: number = 0;
    finishedCustomerOrderCounter: number = 0;

    rep_custOrders_JSON: DataStream
    rep_prodOrders_JSON: DataStream

    counterDelayedCustomerOrders: number = 0;
    counterDelayedCustomerOrdersPerClass: Map<any, [number, DataStream]> = new Map();
    group_delayPerClass: number;

    rep_custOrders: DataStream

    rep_rewardProdSys: DataStream;

    CapacityUsage_Data = new Map<number, [number]>();

    ordersInProduction = new Set<ProductionOrderH1>();

    traffics: TrafficH1[] = [];

    //Special vars for postprocessing
    earlinessSum = 0;
    tardinessSum = 0;
    counterOutputProducts = 0;
    counterTrafficProducts = 0;
    overallRevenue = 0;
    revForH1Optimization = 0

    /**
     * The production system is a central component besides the production network. It represents a complete site. It handles all processes releveant to a site, like resources, production control, manufacturing etc.
     * @param engine the engine which created this production system entity
     */
    constructor(engine: IEngine)
    {
        super();
        this.engine = engine;
        this.analytics = engine.analytics;
        this.config = engine.config.envConfig;
        this.sim = engine.sim;
        this.rep_custOrders_JSON = this.engine.analytics.createDataStreamWriter("custOrders_JSON");
        this.rep_prodOrders_JSON = this.engine.analytics.createDataStreamWriter("prodOrders_JSON");
        this.rep_custOrders = this.engine.analytics.createDataStreamWriter("Verspätungen")

        let prodSysReport = engine.analytics.createNewReport("Reports ProductionSystem");
        this.rep_rewardProdSys = this.engine.analytics.createVisualisationWriter("Reward ProductionSystem", "line", prodSysReport);
        this.rep_custOrders = this.engine.analytics.createVisualisationWriter("Verspätete CustomerOrders", 'line', prodSysReport);

        this.group_delayPerClass = this.engine.analytics.createNewReport("Verspätungen per Klasse");
    }

    resetMachineFlagsKPI() //empty function necessary for IProductionSystem
    { }

    private startTraffics()
    {
        for (let i = 0; i < this.traffics.length; i++)
        {
            let tmp_traffic: TrafficH1 = this.traffics[i];
            (this as any).setTimer(tmp_traffic.nextDate).done(this.runTraffic, this, tmp_traffic);
        }
    }

    createOrderTemplate(demand: IDemand): ICustomerOrder
    {
        this.customerOrderCounter++;
        return (new CustomerOrderH1(demand.product, this.sim.simTime, this, (demand as DemandH1).customer.id));
    }

    private runTraffic(traffic: TrafficH1)
    {

        if (traffic.nextDate == this.sim.time())
        {
            let tmp_prodOrder: ProductionOrderH1 = new ProductionOrderH1(-1, -1, traffic.product, this.sim.time(), new CustomerOrderH1([traffic.product], this.sim.time(), this, -1), true);
            tmp_prodOrder.status = 606; // Traffics basieren auf einer ProductionOrder, es wird nur kalibriert und versendet, Aufbereitung und Justage sind nicht notwendig! 
            let dd: number = this.sim.time() + this.pc.getMaxDurationForState(tmp_prodOrder, 607, this.MachineGroups) + this.pc.getMaxDurationForState(tmp_prodOrder, 700, this.MachineGroups);
            tmp_prodOrder.customerOrder.dueDate = dd;
            tmp_prodOrder.dueDate = dd;
            this.manufactureNextStatus(tmp_prodOrder);
            let randomDur: number = traffic.getDur()
            traffic.nextDate = this.sim.time() + randomDur;

            (this as any).setTimer(randomDur).done(this.runTraffic, this, traffic) //Argument übergeben

        }
        else
        {
            MsgLog.logError("Traffic wurde fehlerhaft aufgerufen!", this, true)
        }

    }

    writeKPIsToReport(order: ICustomerOrder)
    {
        (order as CustomerOrderH1).finalize(this.sim.time(), this.sim.simTiming.getInBaseTime(1, "days"), this.config);

        if (order.notOrderedByCustomer == false)
            if ((order.productionEnd > order.dueDate))
            {
                this.counterDelayedCustomerOrders += 1;
                this.tardinessSum += order.productionEnd - order.dueDate; //only for easy statistics
                order.ProductionOrders.forEach(element =>
                {
                    let prodorder: ProductionOrderH1 = element as ProductionOrderH1;
                    let del = this.counterDelayedCustomerOrdersPerClass.get(prodorder.product.prodTypeStr);
                    if (del === undefined)
                    {
                        let writer = this.engine.analytics.createVisualisationWriter(prodorder.product.prodTypeStr, "line", this.group_delayPerClass);
                        this.counterDelayedCustomerOrdersPerClass.set(prodorder.product.prodTypeStr, [1, writer]);
                    }
                    else
                    {
                        del[0] = del[0] + 1;
                    }
                })
            }
            else
            {
                this.earlinessSum += order.dueDate - order.productionEnd; //only for statistics
            }

        this.rep_custOrders.write(this.engine.productionNetwork.counterRunDemandOrders, this.counterDelayedCustomerOrders);

        this.counterDelayedCustomerOrdersPerClass.forEach((val, key, map) =>
        {
            val[1].write(this.engine.productionNetwork.counterRunDemandOrders, val[0]);
        });

        this.overallRevenue += order.totalRevenue;
        this.counterOutputProducts += order.products.length;
        this.writeReportForOrder(order as CustomerOrderH1);

    }

    private writeReportForOrder(order: CustomerOrderH1)
    {
        let products: number[] = [];
        this.products.forEach(product =>
        {
            products.push(product.id)
        });
        let yearOfCreation = Math.ceil(order.timeOfCreation / this.sim.simTiming.getInBaseTime(365, "days"));
        let tmp = { 'custOrderID': order.id, 'customerID': order.customerID, 'isnull': order.notOrderedByCustomer, 'productIDs': products, 'timeOfCreation': order.timeOfCreation, 'yearOfCreation': yearOfCreation, 'productionEnd': order.productionEnd, 'dueDate': order.dueDate, 'initiallyNegotiatedDueDate': order.initialDueDate, 'revenue': order.totalRevenue, 'expSmoothenedProdTimes': order.saved_ExpSmoothenedProdTimes, 'rewardProdSystem': order.saved_Reward_ProdSys }
        this.rep_custOrders_JSON.write(1, JSON.stringify(tmp));
        this.revForH1Optimization += tmp["revenue"];
        this.finishedCustomerOrderCounter++;
    }

    /** Function for starting the production process of a customer order */
    private manufactureNextStatus(prodOrder: ProductionOrderH1)
    {
        if (this.standardStates.includes(prodOrder.status) == false)
        {
            let extraDueTime: number = this.pc.getMaxDurationForState(prodOrder, prodOrder.status, this.MachineGroups);
            prodOrder.dueDate += extraDueTime;
            prodOrder.customerOrder.dueDate += extraDueTime;
        }

        let machinelist = (prodOrder.product as ProductH1).getMachines(prodOrder.status, this.MachineGroups); // ruft hier jetzt die get Methode des Gewichts auf, damit das Gewicht bekannt ist.
        this.planOrder(prodOrder, machinelist!);

    }

    plan(custOrder: ICustomerOrder)
    {
        (custOrder as CustomerOrderH1).initialDueDate = custOrder.dueDate;
        //SChleife für produktionorder
        for (let index = 0; index < custOrder.products.length; index++)
        {
            this.prodOrderCounter++;
            let tempOrder = new ProductionOrderH1(this.prodOrderCounter, custOrder.dueDate, (custOrder.products[index] as ProductH1), this.sim.time(), custOrder, false);
            tempOrder.status = 100;
            tempOrder.productionStart = this.sim.time();
            this.ordersInProduction.add(tempOrder);
            custOrder.ProductionOrders.push(tempOrder);
            this.manufactureNextStatus(tempOrder);
        }
    }

    start()
    {
        MsgLog.log(MsgLog.types.debug, "ProductionSystem was called", this, false, true);
    }

    register()
    {
        (this as any).setTimer(0).done(this.startTraffics, this);
    }

    /**
     * Relevant for site specific production execution. It takes a list of machines allowed to produce a product. There it tries to maximize machien utility
     * @param order the event to execute
     * @param machineList the list of machines to select from
     */
    private planOrder(order: ProductionOrderH1, machineList)
    {
        let chosenCapa: ResourceH1 | undefined;
        try
        {
            this.engine.analytics?.log(MsgLog.types.debug, "SimTime: " + this.sim.simTime + " --------------------------------------------------------------------", this, false, true)
            this.engine.analytics?.log(MsgLog.types.debug, "Einplanung: " + order.product.prodTypeStr + " " + order.product.mass + "g" + " Prozessstatus: " + order.status, this, false, true)
            this.sort = [];
            this.sort = this.aggregateAllPossibleQueues(machineList); //works with the global sort object and puts result in there!

            // Only parallel machines
            if (this.sort.length == 1 && this.sort[0].parent.parallel == true)
            {
                chosenCapa = this.sort[0];
                chosenCapa.queue.push(order);
                order.plannedDate = this.engine.sim.time() + chosenCapa.parent.ProductionTime.get(order.product.id)!
            }
            // only non parallel machines
            else
            {
                if (this.sort.length != 0)
                {
                    chosenCapa = this.pc.planOrder(this.sort, order, this.MachineGroups);
                }
                else
                {
                    MsgLog.logError("No Machines!", this, true)
                }
            }
            if (chosenCapa != undefined)
            {
                this.triggerMachine(chosenCapa, order);

                this.engine.analytics?.log(MsgLog.types.debug, "Ausgewählte Maschine: " + chosenCapa.parent.name + " Auftragsdauer: " + chosenCapa.parent.ProductionTime.get(order.product.id) + " Geplante Fertigstellung: " + order.plannedDate + " Due Date: " + order.dueDate, this, false, true);
            }
            else
            {
                MsgLog.logError("No Machines!", this, true)
            }
        }
        catch (ex)
        {
            this.engine.analytics?.log(MsgLog.types.error, ex, this, false, true);
        }
    }

    private aggregateAllPossibleQueues(machineList)
    {
        let aggregatedQueues = new Array<ResourceGroupH1>();
        this.sort.length = 0;

        machineList.forEach(element =>
        {
            aggregatedQueues.push(this.MachineGroups.get(element)!);
        });
        if (aggregatedQueues.length == 0) 
        {
            this.engine.analytics?.log(MsgLog.types.error, "No possible Machine!", this, false, true);
        }

        if (aggregatedQueues.length == 0)
        {
            throw "Error: Keine passende Maschine gefunden!";
        }

        aggregatedQueues.forEach((ele) =>
        {
            this.sort.push(...ele.machines);
        });

        return this.sort;
    }

    private triggerMachine(que: ResourceH1, entityObject)
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
    private enterfacility(que: ResourceH1)
    {
        this.MachineGroups.forEach((value, key) =>
        {
            let usage = 0;
            value.machines.map((val, index, ar) =>
            {
                usage += (val.queue.length + (val.inMachining == undefined ? 0 : 1));
            })
            this.CapacityUsage_Data.get(value.id)?.push(usage);
        })


        let order = que.queue.shift();

        if (order != undefined)
        {
            if (que.parent.parallel == true)
            {
                order.productionStartForActiveState = this.sim.time();
                que.parallelOrders.add(order);
                (this as any).setTimer(que.parent.ProductionTime.get(order.product.id)).done(() =>
                {
                    order!.addStatus(que.machineID, this.sim.time());

                    que.parallelOrders.delete(order!);
                    let nextState = order!.product.routeSheet.getNextState(order!.status);
                    if (nextState != -1)
                    {
                        order!.status = nextState;

                        this.manufactureNextStatus(order!);
                    }
                    else
                    {
                        order!.status = nextState;
                        this.ordersInProduction.delete(order!);
                        MsgLog.logDebug("Finished Order:" + order!.product.routeSheet.name + " " + order!.product.mass + "g ---- SimTime: " + que.parent.sim.time() + " Lateness: " + (que.parent.sim.time() - order!.dueDate), this, true);
                        order!.productionEnd = this.sim.time();
                        order!.product.processHistoricData(order!.productionStart, this.sim.time(), order!.customerOrder.dueDate); //Nur historische Daten der Rekalibrierungen und kein Traffic wird herangezogen
                        if (order!.traffic == true)
                        {
                            this.counterTrafficProducts += 1;
                        }
                        else
                        {
                            if ((order!.customerOrder as CustomerOrderH1).isFinished() == true)
                            {
                                this.writeKPIsToReport(order!.customerOrder);
                            }
                        }
                    }
                });
            }
            else
            {
                que.inMachining = order;
                order.productionStartForActiveState = this.sim.time();
                (this as unknown as ISimEntity).setTimer(que.parent.ProductionTime.get(order.product.id)!).done(() =>
                {
                    order!.addStatus(que.machineID, this.sim.time());
                    if (que.inMachining == undefined)
                    {
                        MsgLog.logError("Undefined Que", this, true)
                    }

                    //save the arrival order
                    let finishedOrder: ProductionOrderH1 = que.inMachining!;

                    let nextState = finishedOrder.product.routeSheet.getNextState(finishedOrder.status);
                    if (nextState != -1)
                    {
                        finishedOrder.status = nextState;
                        this.manufactureNextStatus(finishedOrder);
                    }
                    else
                    {
                        finishedOrder.status = nextState;
                        this.ordersInProduction.delete(finishedOrder!);
                        MsgLog.logDebug("Finished Order:" + finishedOrder!.product.routeSheet.name + " " + finishedOrder!.product.mass + "g ---- SimTime: " + que.parent.sim.time() + " Lateness: " + (que.parent.sim.time() - finishedOrder!.dueDate), this, true);
                        order!.productionEnd = this.sim.time();
                        finishedOrder.product.processHistoricData(finishedOrder.productionStart, this.sim.time(), finishedOrder.customerOrder.dueDate);
                        if (order!.traffic == true)
                        {
                            this.counterTrafficProducts += 1;
                        }
                        else
                        {
                            if ((finishedOrder.customerOrder as CustomerOrderH1).isFinished() && finishedOrder.traffic == false)
                            {
                                this.writeKPIsToReport(finishedOrder.customerOrder);
                            }
                        }
                    }
                    que.inMachining = undefined;
                    if (que.queue.length != 0)
                    {
                        this.enterfacility(que);
                    }
                });
            }
        }
    }

    /**
     * This function adds a facility to a site. If site does not exists, it is created. If workplace does not exist it is created. Otherwise capacity of workplace is increased
     * @param sim the Simulation object
     * @param site string name of site
     * @param workplace string name of workplace
     */
    addFacility(sim, id: number, workplace: string, minweight: number, maxweight: number, parallel: boolean, ProductionTime: Map<number, number>)
    {

        let wp = this.MachineGroups.get(id); //Workplace = WorkcenterType
        if (wp) //If maschinetype already exists, just add one as a free ressource
        {
            wp.addMachine(id);
            MsgLog.log(MsgLog.types.debug, "Added Capacity to already existing: " + workplace + ". New Capacity: " + "not Implemented", this, false, true);
        }
        else //If machinetype does not exist, create one
        {
            let temp = this.createGroupAndFirstMachine(sim, id, workplace, minweight, maxweight, parallel, ProductionTime);
            this.MachineGroups.set(id, temp);
            MsgLog.log(MsgLog.types.debug, "Facility created: " + workplace, this, false, true);
        }
        this.CapacityUsage_Data.set(id, [0]);
    }

    private createGroupAndFirstMachine(sim, id: number, workplace: string, minweight: number, maxweight: number, parallel: boolean, ProductionTime: Map<number, number>)
    {
        let temp = new ResourceGroupH1(workplace, sim, minweight, maxweight, parallel, ProductionTime, this.engine.randomSIM);
        temp.addMachine(id);
        return temp;
    }

    private getMaxOfAllProductionDuration(): number
    {
        let max: number = 0;
        this.MachineGroups.forEach(machineGroup =>
        {
            machineGroup.ProductionTime.forEach(element =>
            {
                if (element.valueOf() > max)
                {
                    max = element.valueOf();
                }
            })
        });
        return max
    }
    /**
     * Deprecated
     */
    private getMinCalibrationDurationsForProduct(): number[]
    {
        let result: number[] = [];
        this.engine.productionNetwork.curOrder?.products.forEach(product =>
        {
            let possMachines_ids: number[] = (product as ProductH1).getMachines(100, this.MachineGroups);
            let possMachines: ResourceH1[] = []
            possMachines_ids.forEach(id =>
            {
                possMachines.push(this.MachineGroups.get(id)!.machines[0]);
            })
            let minCalibrationDuration: number;
            minCalibrationDuration = possMachines[0].parent.ProductionTime.get((product as ProductH1).id)!;
            for (let i = 1; i < possMachines.length; i++)
            {
                let tmp_time: number = possMachines[i].parent.ProductionTime.get((product as ProductH1).id)!
                if (tmp_time < minCalibrationDuration)
                {
                    minCalibrationDuration = tmp_time;
                }
            }
            result.push(minCalibrationDuration);
        });
        let maxdur: number = this.getMaxOfAllProductionDuration();
        for (let i = 0; i < result.length; i++)
        {
            result[i] = result[i] / maxdur;
        }
        return result
    }

    private getExpSmoothenedProdTime(custOrder: CustomerOrderH1)
    {
        let smoothenedProdTimes: number[] = []
        custOrder.products.forEach(product =>
        {
            let tmp_prodTime: number = (product as ProductH1).getExpSmoothing_prodTime();
            smoothenedProdTimes.push(tmp_prodTime);

        });
        return smoothenedProdTimes
    }

    private state_MaxExpSmoothenedDDDeviation(): number
    {
        let max: number = -20000;
        this.engine.productionNetwork.curOrder!.products.forEach(product =>
        {
            let tmp_DDDeviation: number = (product as ProductH1).getExpSmoothing_dueDateDeviation();
            if (tmp_DDDeviation > max)
            {
                max = tmp_DDDeviation;
            }
        });

        let old_min = -this.sim.simTiming.getInBaseTime(10, "days")
        let old_max = this.sim.simTiming.getInBaseTime(4, "days")
        let new_min = 0
        let new_max = 1
        let scaled_deviation = (max - (old_min)) / (old_max - (old_min)) * (new_max - new_min);

        scaled_deviation = Math.min(1, scaled_deviation);
        scaled_deviation = Math.max(0, scaled_deviation);

        return scaled_deviation

    }

    //Part of IEnvironmentComponent
    getStateFunctions(): [Array<() => number | number[]>, number]
    {
        let res = new Array<() => number | number[]>();
        let states: number = 0;

        res.push((() =>
        {
            return this.state_MaxExpSmoothenedDDDeviation()
        }).bind(this))

        //increase state length by count of machine types
        states += 1;

        //return the state and the state length
        return [res, states];
    }

    //Part of IEnvironmentComponent 
    calculateReward(): number
    {
        let curOrder: ICustomerOrder | null = this.engine.productionNetwork.curOrder;
        let rew = 0;
        if (curOrder!.notOrderedByCustomer != true)
        {
            let dueTime: number = curOrder!.dueDate - this.sim.time();
            let prodTimes = this.getExpSmoothenedProdTime((curOrder as CustomerOrderH1));
            (curOrder as CustomerOrderH1).saved_ExpSmoothenedProdTimes.push(...prodTimes);


            let maxi: number = 0;
            maxi = Math.max(...prodTimes);

            if (dueTime >= maxi)
            {
                rew = 1;
            }
            else
            {
                let old_min = 0
                let old_max = this.sim.simTiming.getInBaseTime(3, "days")
                let new_min = 0
                let new_max = 1
                let scaled_deviation = ((maxi - dueTime) - (old_min)) / (old_max - (old_min)) * (new_max - new_min);

                scaled_deviation = Math.min(1, scaled_deviation);
                scaled_deviation = Math.max(0, scaled_deviation);

                rew = -this.config.tardinessPenalty * scaled_deviation
            }
        }
        else
        {
            rew = 0;
        }
        this.rep_rewardProdSys.write(this.engine.productionNetwork.counterRunDemandOrders, rew);
        (curOrder as CustomerOrderH1).saved_Reward_ProdSys = rew;
        return rew
    }
}