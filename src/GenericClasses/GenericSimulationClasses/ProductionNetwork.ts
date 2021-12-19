/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer (First version)

Copyright (c) 2021 Festo SE & Co. KG 

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import MsgLog from "../../SystemManagement/MessengingSystem/MsgLog";
import msgLog from "../../SystemManagement/MessengingSystem/MsgLog";
import { Sim, ISimEntity, SimEntity } from "simts";
import Customer from "./Customer";
import IEngine from "./Interfaces/IEngine";
import IEnvironmentComponent from "./Interfaces/IEnvironmentComponent";
import IProductionSystem from "./Interfaces/IProductionSystem";
import ICustomerOrder from "./Interfaces/ICustomerOrder";
import IDemand from "./Interfaces/IDemand";
import DataStream from "../../SystemManagement/Analytics/DataStream";
import { ExperimentSettings } from "../../SystemManagement/Configuration/ExperimentSettings";
import Phase from "../GenericMLClasses/Phase";



export class ProductionNetwork extends SimEntity implements IEnvironmentComponent
{
    engine: IEngine;
    sim: Sim; 
    manufacturing: IProductionSystem;
    driftStarted = false;


    private _customers = new Array<Customer>();
    public get customers(): Array<Customer>
    {
        return this._customers;
    }

    config: ExperimentSettings;

    firstIteration: boolean = true;

    //counter for running a product order
    counterRunDemandOrders: number = 0;

    //counter for null orders
    private _counterNullOrders: number = 0;

    public get counterNullOrders():number
    {
        return this._counterNullOrders;
    }

    lastIteration: boolean = false;

    public lastProduct: number = 0;

    private lastDayBeforeMachinesReward = 0;
    private _lastDayBeforeMachineKPI = 0;

    //last order calculation
    public lastOrder: ICustomerOrder | null = null;
    lastReward: number = 0;
    avg = 0; //average reward for AI

    curCustomer: Customer | null = null
    curOrder: ICustomerOrder | null = null;
    replayCounter = 0;

    //reports definition
    private repNullOrders!: DataStream;
    private dueTimeReport!: DataStream;

    private scaledActionsReportParameterL: Array<DataStream> | undefined;
    private preferencesLReport: Array<DataStream> | undefined;
    private preferencesNReport: Array<DataStream> | undefined;
    private scaledActionsReportParameterK: Array<DataStream> | undefined;
    private scaledActionsReportParameterN_: Array<DataStream> | undefined;
    private gotOrder = new Array<DataStream>();

    private customerOrderSummary!: DataStream;

    private revPerCustomer = new Map<number, number>();
    private AcceptedOrderSumPerCustomer = new Map<number, number>();
    private OrderSumPerCustomer = new Map<number, number>();

    private utilityOfCus = new Array<DataStream>();

    private timeReport: DataStream | undefined;
    private demandReport!: DataStream;
    //Reward reports
    private _repReward!: DataStream;
    private _reportAverageReward = -1;
    private rewWriter!: DataStream;
    rawReward!: DataStream;

    /**
     * The production network is the entry point for every simulation in the context of this work. It generates customer requests, interacts with the orchestrator and transmits an order to the production system.
     */
    constructor(engine: IEngine, productionSystem: IProductionSystem, customers: Customer[])
    {
        super();

        this._customers = customers;


        this.sim = engine.sim;
        this.engine = engine;
        this.manufacturing = productionSystem;
        this.config = this.engine.config;

        //initializing report variables
        this.scaledActionsReportParameterL = new Array<DataStream>(this.customers.length);
        this.preferencesLReport = new Array<DataStream>(this.customers.length);
        this.scaledActionsReportParameterK = new Array<DataStream>(this.customers.length);
        this.scaledActionsReportParameterN_ = new Array<DataStream>(this.customers.length);
        this.preferencesNReport = new Array<DataStream>(this.customers.length);
        this.initializeReports()

    }

    private initializeReports()
    {
        let generalReports = this.engine.analytics.createNewReport("Allgemeine Reports");

        this.timeReport = this.engine.analytics.createVisualisationWriter("Zeitfortschritt", "line", generalReports);
        this.demandReport = this.engine.analytics.createVisualisationWriter("Nachfrage für einen Zeitabschnitt", "line", generalReports);

        let customerActionsReportsParameter = this.engine.analytics.createNewReport("Report zu Kunden");

        let paramWriter: DataStream;

        //initilizing reports

        let analytics = this.engine.analytics;

        this.repNullOrders = this.engine.analytics.createVisualisationWriter("Anzahl von nicht verhandelten Aufträgen", "line", generalReports);
        this.dueTimeReport = this.engine.analytics.createVisualisationWriter("Verhandelte Lieferzeiten", "line", generalReports);

        this.rawReward = this.engine.analytics.createDataStreamWriter("Raw Reward");

        //Belohnungsaufzeichnung
        this._reportAverageReward = analytics.createNewReport("Belohnung des Agenten")
        this._repReward = analytics.createVisualisationWriter("Durchschnittliche Belohnung", "line", this._reportAverageReward)
        this.rewWriter = analytics.createVisualisationWriter("Reward", "line", this._reportAverageReward);

        this.customerOrderSummary = this.engine.analytics.createVisualisationWriter("Auftragsübersicht nach Kunden", "story", customerActionsReportsParameter);

        for (let i = 0; i < this.customers.length; i++)
        {
            if (this.scaledActionsReportParameterL)
            {
                this.scaledActionsReportParameterL[i] = this.engine.analytics.createVisualisationWriter("Aktion für Parameter L und Kunde " + (i + 1), "line", customerActionsReportsParameter);
            }

            if (this.preferencesLReport)
            {
                this.preferencesLReport[i] = this.engine.analytics.createVisualisationWriter("Präferenz Parameter L und Kunde " + (i + 1), "line", customerActionsReportsParameter);

            }

            if (this.scaledActionsReportParameterK)
            {
                this.scaledActionsReportParameterK[i] = this.engine.analytics.createVisualisationWriter("Aktion für Parameter K und Kunde " + (i + 1), "line", customerActionsReportsParameter);
            }

            if (this.scaledActionsReportParameterN_)
            {
                this.scaledActionsReportParameterN_[i] = this.engine.analytics.createVisualisationWriter("Aktion für Parameter N_ und Kunde " + (i + 1), "line", customerActionsReportsParameter);
            }

            if (this.preferencesNReport)
            {
                this.preferencesNReport[i] = this.engine.analytics.createVisualisationWriter("Präferenz Parameter N und Kunde " + (i + 1), "line", customerActionsReportsParameter);

            }

            paramWriter = this.engine.analytics.createVisualisationWriter("Parameter des Kunden " + (i + 1), "story", customerActionsReportsParameter);
            paramWriter.write("b->l", this.customers[i].b);
            paramWriter.write("a->k", this.customers[i].a);
            paramWriter.write("d_->n_", this.customers[i].d_);
            paramWriter.write("v", this.customers[i].v);

            this.gotOrder.push(this.engine.analytics.createVisualisationWriter("Auftrag von Kunde " + (i + 1) + " erhalten? ", "line", customerActionsReportsParameter));
            this.utilityOfCus.push(this.engine.analytics.createVisualisationWriter("Nutzen von Kunde " + (i + 1), "line", customerActionsReportsParameter));
        }

    }

    /**
     * Basic function of every sim entity
     */
    start()
    {
        MsgLog.log(msgLog.types.debug, "production network was called.", this, false, true);
    }


    registerInitialSimEvent()
    {
        this.setTimer(0).done(this.initializeRundDemandandOrder, this); //Öffnet execute(), sobald der Timer gesetzt wurde
        this.setTimer(this.sim.simTiming.OneDay).done(this.setLastIteration, this);
        /* this.setTimer(Math.round(this.sim.simTiming.getInBaseTime(365, "days") * this.config.envConfig.amountOfYearsForUnusedMachinesReward)).done(this.setLastDayBeforeMachineReward, this); //diese Umrechnung haben wir vorgenommen, da der Konfigurationsparameter in Jahren angegeben wird, die Base Unit von  simTiming aber in Minuten ist. Das Math.round() haben wir eingeführt, damit z.B. auch halbe Jahre im Konfigurationsparameter angegeben werden können. Es wird somit auf einen ganzen Tag gerundet. Dies folgt aus der Überlegung, dass der Reward für die unbenutzte Maschine mit dem Reward nach einem Tag zusammenfallen soll. Am Ende überführen wir wieder alles in Minuten., Bsp. config Parameter = 1,5 Jahre, Math.round(525 600 Minuten pro Jahr / 1440 Minuten pro Tag * 1,5 Jahre)*1440 Minuten pro Tag = Math.round(365 Tage pro Jahr * 1,5 Jahre)*1440 Minuten pro Tag = Math.round(547,5 Tage)*1440 Minuten pro Tag = 548 Tage * 1440 Minuten pro Tag = 789120 Minuten */

        //Setze den Timer, sodass nach amountOfYearsForUnusedMachineKPI das erste mal der Verkauf der Maschinen simuliert wird.
        this.setTimer((this.config.envConfig.totalSimTime * this.config.envConfig.startOfBenchmarkTest) + this.config.envConfig.lengthSettlingPhase + this.sim.simTiming.getInBaseTime(365, "days") * this.config.envConfig.amountOfYearsForUnusedMachineKPI).done(this.setLastDayBeforeMachineKPI, this);

        if (this.config.envConfig.useAI == true)
        {

            //Einschwngphase von einem Simulationsmonat
            this.config.envConfig.useAI = false;

            //Einschwingphase beträgt yearsEischwingphase der Trainingszeit (totalSimTime*BenchmarkTest)
            this.setTimer(this.config.envConfig.lengthSettlingPhase).done(this.endEinschwingphase, this);
        }

        //Starte Szenarien
        (this as unknown as ISimEntity).setTimer(this.config.envConfig.totalSimTime * this.config.envConfig.startOfBenchmarkTest + this.config.envConfig.lengthSettlingPhase).done(this.startScenario, this);

    }

    private startScenario()
    {
        this.driftStarted = true;
    }

    private setLastIteration()
    {
        this.lastIteration = true;
        this.setTimer(this.sim.simTiming.OneDay).done(this.setLastIteration, this);
    }

    private setLastDayBeforeMachineKPI()
    {
        this._lastDayBeforeMachineKPI = 1;
        this.setTimer(this.sim.simTiming.getInBaseTime(365, "days") * this.config.envConfig.amountOfYearsForUnusedMachineKPI).done(this.setLastDayBeforeMachineKPI, this);

    }

    endEinschwingphase()
    {
        //Setze die Flags der KPI zurück, dies ist insbesondere für die Testphase relevant
        this.config.envConfig.useAI = true;
    }


    /**
    * Will be called by simulation for execution of market. It is the main loop
    */

    initializeRundDemandandOrder()
    {
        for (let i = 0; i < this.customers.length; i++)
        {
            //check if product should be produced
            let dms = this.customers[i].demands;
            dms.forEach(ele =>
            {
                (this as unknown as ISimEntity).setTimer(ele.getNextDate()).done(this.runDemandandOrder, { network: this, demand: ele, customer: this.customers[i] }); //simTime must be zero right now, so no addition needed
            });

        }

        //for debugging
        this.engine.orchestrator?.printWeights(this.engine.orchestrator?.agentL.actor)
        this.engine.orchestrator?.printWeights(this.engine.orchestrator?.agentL.critic)
        this.engine.orchestrator?.printWeights(this.engine.orchestrator?.agentN.actor)
        this.engine.orchestrator?.printWeights(this.engine.orchestrator?.agentN.critic)
    }

    async runDemandandOrder()
    {


        let demand: IDemand = (this as any).demand;
        let customer: Customer = (this as any).customer;
        let that: ProductionNetwork = (this as any).network;

        let simTimeNow = that.sim.time(); //gibt die Zeit der Simulation zurück
        that.timeReport?.write(that.counterRunDemandOrders, simTimeNow);
        //iterate over all products, check if to produce, draw quantity, select customer, choose, and manufacture
        MsgLog.log(msgLog.types.debug, "SimTime: " + simTimeNow, that, false, true);
        MsgLog.log(msgLog.types.debug, "-----------------------", that, false, true);


        if (that.lastIteration == true)
        {
            that.lastProduct = 1;
        }

        let dueTime = -1;

        that.curOrder = that.manufacturing.createOrderTemplate(demand);
        that.curCustomer = customer;

        if (that.curOrder.notOrderedByCustomer == false) 
        {
            //only addSample if it's not the first iteration
            if (!that.firstIteration && that.config.envConfig.useAI)
            {
                //always do addSample, also when useKI false (because of the reporting that happens there)
                //add observation to memory based on current state
                //add sample to memory, orchestrator knows that nextState is null
                that.engine.orchestrator!.addSample(that.lastReward);

            }
            if (that.config.envConfig.useAI == true)
            {
                if (that.replayCounter == that.config.envConfig.replayAfterAmount)
                {
                    that.replayCounter = 0;
                    await that.engine.orchestrator!.replay(); //simTime must be zero right now, so no addition needed 
                }
                that.replayCounter++;
            }
            //in the first run of this function, the class variable firstIteration will be set to false
            that.firstIteration = false;

            let action = new Array(3);
            if (!that.config.envConfig.useAI)
            {
                action[0] = 0.5;
                action[1] = 10;
                action[2] = 0.3;
            }
            else if (that.config.envConfig.useAI)
            {
                that.engine.analytics.logDebug('call function get action in market simulation', that)
                action = that.engine.orchestrator!.getAction([that.config.envConfig.minimumParameterK, that.config.envConfig.minimumParameterL, that.config.envConfig.minimumParameterN_, that.config.envConfig.minimumParameterM],
                    [that.config.envConfig.maximumParameterK, that.config.envConfig.maximumParameterL, that.config.envConfig.maximumParameterN_, that.config.envConfig.maximumParameterM])
            }

            that.curOrder = customer.requestAndChoose(that.curOrder!, action);
            that.curOrder!.id = that.counterRunDemandOrders;
            dueTime = (that.curOrder?.notOrderedByCustomer == false) ? that.curOrder.dueTime : -1;


            if (that.curOrder?.notOrderedByCustomer == true)
            {
                that.engine.productionSystem.writeKPIsToReport(that.curOrder);
            }

            that.lastOrder = that.curOrder;

            if (that.curOrder?.notOrderedByCustomer == false) //null if customer does not order
            {
                that.curOrder.dueDate = that.curOrder.dueTime + simTimeNow;
                that.curOrder.timeOfCreation = simTimeNow;
                that.manufacturing.plan(that.curOrder); 
            } else
            {
                //update counter as one null order occured
                that._counterNullOrders++;
            }

            //update counter, as one product was planned
            that.counterRunDemandOrders++;

            //set a limit for the penalty so that the reward is never smaller than when borders are violated
            that.lastReward = Math.max((that.engine.orchestrator!.agentL.environment.computeReward()), -(that.engine.numberOfProducts as number) * that.config.envConfig.maximumPenalty);

            that.rawReward.write("RawReward", that.lastReward);

            that.lastIteration = false;
            that.lastProduct = 0;

            if (that._lastDayBeforeMachineKPI == 1)
            {
                that.engine.productionSystem.resetMachineFlagsKPI(false);
                that._lastDayBeforeMachineKPI = 0;

            }

            //plot the actions
            that.doReporting(that.counterRunDemandOrders, dueTime, that._counterNullOrders, that.customers.indexOf(customer), action);
        }
        //Call up order process again for the next day
        (that as unknown as ISimEntity).setTimer(demand.getNextDate()).done(that.runDemandandOrder, { network: that, demand: demand, customer: customer }); //simTime must be zero right now, so no addition needed        
    }

    debugCounter = 0;
    demandCounter = 0;

    private doReporting(counterRunDemandOrders, dueTime, counterNullOrders, customerIndex, action: number | number[])
    {
        //report for dueTime
        if (dueTime != -1)
        {
            this.dueTimeReport.write(counterRunDemandOrders, dueTime / 1440)
        }

        this.repNullOrders.write(counterRunDemandOrders, counterNullOrders)

        //report for dueTime
        if (dueTime != -1)
            this.dueTimeReport.write(counterRunDemandOrders, dueTime)

        //plot the non null orders
        this.repNullOrders.write(counterRunDemandOrders, counterNullOrders)

        if (this.config.envConfig.useAI)
        {


            if ((action[0] != undefined) && (this.scaledActionsReportParameterK != undefined))
            {
                this.scaledActionsReportParameterK[customerIndex].write(counterRunDemandOrders, action[0])
            }
            if ((action[1] != undefined) && (this.scaledActionsReportParameterL != undefined))
            {
                this.scaledActionsReportParameterL[customerIndex].write(counterRunDemandOrders, action[1])
            }
            if ((action[2] != undefined) && (this.scaledActionsReportParameterN_ != undefined))
            {
                this.scaledActionsReportParameterN_[customerIndex].write(counterRunDemandOrders, action[2])
            }

            this.avg = 0.02 * this.lastReward + 0.98 * this.avg;
            //set the average reward to 0
            this.rewWriter.write(this.counterRunDemandOrders, this.lastReward);
            //plot the average reward
            this._repReward.write(this.counterRunDemandOrders, this.avg);
        }

        if (this.preferencesLReport != undefined)
        {
            this.preferencesLReport[customerIndex].write(counterRunDemandOrders, this.curCustomer!.b)
        }
        if (this.preferencesNReport != undefined)
        {
            this.preferencesNReport[customerIndex].write(counterRunDemandOrders, this.curCustomer!.d_ + this.curCustomer!.v)
        }


        this.gotOrder[customerIndex].write(counterRunDemandOrders, this.curOrder?.notOrderedByCustomer ? 0 : 1);
        this.utilityOfCus[customerIndex].write(counterRunDemandOrders, this.curCustomer?.curUtility);

        let val = this.revPerCustomer.get(this.curCustomer!.id);
        if (val == undefined)
            val = 0;
        this.revPerCustomer.set(this.curCustomer!.id, val + (this.curOrder?.notOrderedByCustomer ? 0 : this.curOrder!.relativePriceSurcharge));

        val = this.AcceptedOrderSumPerCustomer.get(this.curCustomer!.id);
        if (val == undefined)
            val = 0;

        this.AcceptedOrderSumPerCustomer.set(this.curCustomer!.id, val + (this.curOrder?.notOrderedByCustomer ? 0 : 1));

        val = this.OrderSumPerCustomer.get(this.curCustomer!.id);
        if (val == undefined)
            val = 0;

        this.OrderSumPerCustomer.set(this.curCustomer!.id, val + 1);

        if (this.sim.time() - 10000 * this.demandCounter > 0)
        {
            this.demandReport.write(this.sim.time(), this.debugCounter);
            this.demandCounter++;
            this.debugCounter = 0;
        }
        this.debugCounter++;


    }

    finish()
    {
        for (let index = 0; index < this.customers.length; index++)
        {
            const element = this.customers[index];
            this.customerOrderSummary.write("RelativeSurcharge für Kunde " + index, this.revPerCustomer.get(element.id));
            this.customerOrderSummary.write("Erhaltene Aufträge von Kunde " + index, this.AcceptedOrderSumPerCustomer.get(element.id));
            this.customerOrderSummary.write("Auftragsanfrage von Kunde " + index, this.OrderSumPerCustomer.get(element.id));
        }
    }


    calculateReward(): number
    {
        let res = 0;

        if (this.lastOrder?.notOrderedByCustomer == false)
        {

            let priceSurcharge = (this.lastOrder as ICustomerOrder).relativePriceSurcharge

            if (this.engine.orchestrator?.currentPhase == Phase.l1 || this.engine.orchestrator?.currentPhase == Phase.l2)
            {
                //Reward for agent L
                res = (300 - priceSurcharge * 200)
            } else
            {
                //Reward for agent N
                res = priceSurcharge * 100
            }
        } else
        {
            res = -this.engine.config.envConfig.nullOrderPenalty
        }

        msgLog.log(msgLog.types.debug, 'reward from market is ' + res, this)
        msgLog.log(msgLog.types.debug, 'reward in market calculated correctly ', this)

        //return the reward from the market simulation
        return res;
    }

    /**
     * function for getting the state for KI
     * @returns returns the state for KI
     */
    getStateFunctions(): [Array<() => number | number[]>, number]
    {
        let states = 0;
        let res = new Array<() => number | number[]>();

        //customer state with one hot encoding
        res.push((() =>
        {
            //get one hot state of given the current customer 
            return this.oneHotEncodingCustomer(this.curCustomer!.id, this.customers.length)
        }).bind(this))

        //add the number of customers to the state length
        states += this.customers.length

        return [res, states];
    }

    /**
     * function for encoding the customer one hot
     * @param currentID takes the current id of the customer
     * @param maximumID takes the maximum id of the customer
     * @returns returns the customer id one hot encoded
     */
    private oneHotEncodingCustomer(currentID: number, maximumID: number): number[]
    {

        //create one hot array with length of maximum id
        let oneHotArray = new Array<any>(maximumID);

        //iterate through all id's
        for (let i = 0; i < maximumID; i++)
        {

            //if iterated id equals current id, set array entry to 1, else to 0
            if (currentID == i)
            {
                oneHotArray[i] = 1;
            } else
            {
                oneHotArray[i] = 0;
            }
        }


        msgLog.log(msgLog.types.debug, 'oneHotArray for customer state', this)
        msgLog.log(msgLog.types.debug, oneHotArray, this)

        //return the one hot array
        return oneHotArray;
    }

}


