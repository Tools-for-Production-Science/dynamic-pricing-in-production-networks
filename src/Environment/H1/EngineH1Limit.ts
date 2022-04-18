/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { Random, Sim, PQueue, DistributionType } from "simts";
import lineByLine = require('n-readlines');
import { Analytics } from "../../SystemManagement/Analytics/Analytics";
import { col } from "../../SystemManagement/Configuration/DataformatEnum";
import MsgLog from "../../SystemManagement/MessengingSystem/MsgLog";
import msgLog from "../../SystemManagement/MessengingSystem/MsgLog";
import IEngine from "../../GenericClasses/GenericSimulationClasses/Interfaces/IEngine";
import { ProductionNetwork } from "../../GenericClasses/GenericSimulationClasses/ProductionNetwork";
import Paths from "../../SystemManagement/Configuration/Paths";
import Orchestrator from "../../GenericClasses/GenericMLClasses/Orchestrator";
import ProductH1 from "./ProductionNetworkModule/ProductH1" //"../V2/CustomerModule/Product"; // CHANGED TO ..\V1\CustomerModule\Product.ts
import { ExperimentSettings } from "../../SystemManagement/Configuration/ExperimentSettings";
import RouteSheet, { transform_ways } from "../../GenericClasses/GenericSimulationClasses/RouteSheet";
import Customer from "../../GenericClasses/GenericSimulationClasses/Customer";
import Demand from "./ProductionNetworkModule/DemandH1";
import { ProductionSystemH1 as ProductionSystemH1 } from "./ProductionSystemModule/ProductionSystemH1";
import Environment from "../../GenericClasses/GenericMLClasses/Environment";
import IProductionSystem from "../../GenericClasses/GenericSimulationClasses/Interfaces/IProductionSystem";
import fs = require('fs');
import TrafficH1 from "./ProductionSystemModule/Traffic";

type transform_product = Array<
    {
        prod_no: number;
        prodID: number;
    }
>

export interface customConfig
{
    /**
     * In percentage change. Demand is not linear scalable, therefore 0.6 means chance of status quo demand to be considered is 60%
     */
    demandFactor: number,
    /**
     * This list defines which machines should be removed or duplicated in a run. Removing prevents duplication. Duplication can only be done once, so right now it is not possible to e.g. duplicate id 7 twice to get three machines
     */
    machineFactor: { rem: Array<number>, add: Array<number> },
    /**
     * percentage change of price sensitivty 
     */
    priceFactor: number,
    /**
     * percentage change of time sensitivity 
     */
    dueFactor: number
}

export default class EngineH1Extension implements IEngine
{

    sim = new Sim();

    productionNetwork: ProductionNetwork;
    productionSystem: ProductionSystemH1;
    orchestrator: Orchestrator;
    randomSIM: Random;
    randomAI: Random;

    config: ExperimentSettings;
    analytics: Analytics;
    numberOfProducts = 0;

    /**
     * Setup a new engine instance for the h1 environment
     * @param config the configuration of the experiment
     * @param analytics a reference to the analytics object to document data
     */
    constructor(config: ExperimentSettings, analytics: Analytics, customConfig: customConfig)
    {
        this.randomSIM = new Random(config.seed);
        this.sim.simTiming.setTwoShiftModel(true);
        this.config = config;
        this.analytics = analytics;
        this.randomAI = new Random(config.seed);
        this.productionSystem! = new ProductionSystemH1(this);
        this.productionNetwork! = this._initialize(customConfig);


        this.addEntities();

        let env = new Environment();
        msgLog.log(msgLog.types.debug, 'environment initialized', this)

        env.registerComponent(this.productionNetwork);
        env.registerComponent(this.productionSystem);

        env.setReady();

        this.orchestrator = new Orchestrator(env, config, this.sim, this.randomAI, this.analytics);
    }


    protected _initialize(customConfig: customConfig): ProductionNetwork
    {
        let skillmap = this.loadSkillMap(customConfig.machineFactor);
        this.productionSystem.products = this.loadProducts(skillmap);
        this.numberOfProducts = this.productionSystem.products.length;
        this.loadMachines(this.productionSystem, customConfig.machineFactor);

        let curAr = this._loadCustomersAndDemands(skillmap, customConfig.demandFactor, customConfig.priceFactor, customConfig.dueFactor);

        let productionNetwork = new ProductionNetwork(this, (this.productionSystem as IProductionSystem), curAr);
        this.productionSystem.products.forEach(product => product.initializeExpSmoothening(this.productionSystem));

        return productionNetwork
    }

    protected addEntities()
    {
        this.sim.addEntity(this.productionSystem);
        this.sim.addEntity(this.productionNetwork);
    }

    /** takes the transform_product type created from the JSON input and returns an array of products */
    protected findProducts(transformProduct: transform_product, skillmap: Map<string, RouteSheet>): ProductH1[]
    {
        let products: ProductH1[] = [];
        transformProduct.forEach(element =>
        {
            let found: boolean = false;
            let tmp_product = this.productionSystem.products.find(product => product.id == element.prodID)
            if (tmp_product != undefined)
            {
                products.push(tmp_product);
            }
            else
            {
                MsgLog.logError(("ProduktID " + element.prodID.toString() + " wurde nicht nicht gefunden!"), this, true, true);
            }
        });
        return products;
    }
    /**returns the DistributionType from a string */
    protected findDist(dist: string): DistributionType
    {
        let distType: DistributionType;
        if (dist == "norm")
        {
            distType = "norm"
        }
        else if (dist == "expon")
        {
            distType = "expon"
        }
        else
        {
            distType = ""
        }
        return distType
    }

    protected loadTraffic(trafficIntensity: number)
    {
        let line; //active line of the csv file
        let liner = new lineByLine(Paths.H1.traffic); //reads the csv file
        liner.next(); //Skip headline of csv
        while (line = liner.next()) //iterate through the whole input csv file
        {
            let tmp_line: any[] = (line.toString() as string).replace("\r", "").split(",");;
            let product = this.findProductByID((tmp_line[col.aw_traf_prodID] as any) * 1)
            if (product != undefined)
            {
                let interArrival: number = (tmp_line[col.aw_traf_interarrival] as any) * 1 / trafficIntensity;
                let tmp_traffic: TrafficH1 = new TrafficH1(product, interArrival, this.randomSIM);
                this.productionSystem.traffics.push(tmp_traffic);
            }
        }

    }

    protected findProductByID(prodID: number): ProductH1 | undefined
    {
        let tmp_product: ProductH1
        for (let i = 0; i < this.productionSystem.products.length; i++)
        {
            let product: ProductH1 = this.productionSystem.products[i];
            if (product.id == prodID)
            {
                tmp_product = product;
                return tmp_product
            }
        }
        return tmp_product!
    }

    /** Checks if the distribution is compatible to the simulation and the parameters are valid for the selected distribution.  */
    protected checkTimeDistParameters(distType: DistributionType, timeDistributionParameters: Number[]): boolean
    {
        if (distType == "norm" && timeDistributionParameters.length == 2 && timeDistributionParameters[0] > 0 && timeDistributionParameters[1] >= 0)
        {
            return true
        }
        else if (distType == "expon" && timeDistributionParameters.length == 2 && timeDistributionParameters[0] == 0 && timeDistributionParameters[1] >= 0)
        {
            return true
        }
        else
        {
            MsgLog.logError("Invalid distribution or parameters for the interarrival times!", this, true, true);
            return false
        }
    }
    /** Recognizes false CSV File Input from Excel and corrects it */
    protected correctExcelStringforJSON(string: string): string
    {
        let start = string.substring(0, 1)
        let end = string.substring(string.length - 1, string.length)
        if ((start == "\"") && (end == "\""))
        {
            string = string.substring(1, string.length - 1);
            while (string.includes("\"\""))
            {
                string = string.replace("\"\"", "\"");
            }
        }
        return string
    }
    /** Returns the position of the customer in the customer Array of the ProductionNetwork. Returns -1 if the customerID was not found in the array. */
    protected findCustomerByID(customerID: number, cusAr: Customer[]): number
    {
        let custIndex = -1;
        for (let i = 0; i < cusAr.length; i++)
        {
            if (cusAr[i].id == customerID)
            {
                custIndex = i;
                break
            }
        }
        return custIndex
    }

    protected loadCustomers(priceFactor: number, dueFactor: number): Customer[]
    {
        let line; //active line of the csv file
        let liner = new lineByLine(Paths.H1.customers); //reads the csv file
        liner.next(); //Skip headline of csv

        let cusAr: Customer[] = [];
        let i = 0;
        while (line = liner.next()) //iterate through the whole input csv file
        {
            let tmp_line: string = (line.toString() as string).replace("\r", "");
            while (tmp_line.includes(","))
            {
                tmp_line = tmp_line.replace(",", ".");
            }
            line = tmp_line.split(';');

            let customerID: number = (line[col.aw_cust_custID] as any) * 1;
            let customerName: string = (line[col.aw_cust_name] as any);

            let a: number = (line[col.aw_cust_a]) * 1;
            let b: number = (line[col.aw_cust_b] as any) * 1;
            b = b + dueFactor * b
            let d_: number = (line[col.aw_cust_d_] as any) * 1;
            d_ = d_ + d_ * priceFactor;
            let v: number = (line[col.aw_cust_v] as any) * 1;
            v = v + v * priceFactor;

            let pos = cusAr.push(new Customer(this, this.config.envConfig, customerID, this.randomSIM, a, b, d_, v)) - 1;
            cusAr[pos].name = customerName;

            MsgLog.logDebug("Customer added, customerID: " + cusAr[pos].id + ", customerName: " + cusAr[pos].name, this, true);
        }
        return cusAr
    }

    protected _loadCustomersAndDemands(skillmap: Map<string, RouteSheet>, demandFactor: number = 1, priceFactor: number = 0, dueFactor: number = 0): Array<Customer>
    {
        let line; //active line of the csv file
        let liner = new lineByLine(Paths.H1.demands); //reads the csv file
        liner.next(); //Skip headline of csv

        let cusAr: Customer[] = this.loadCustomers(priceFactor, dueFactor);

        while (line = liner.next()) //iterate through the whole input csv file
        {
            let tmp_line: string = (line.toString() as string).replace("\r", "")
            line = tmp_line.split(';');
            let tmp_products_str: string = (line[col.aw_dem_prod] as any);
            tmp_products_str = this.correctExcelStringforJSON(tmp_products_str);
            let tmp_products: transform_product = JSON.parse(tmp_products_str);
            let products: ProductH1[] = [];
            products = this.findProducts(tmp_products, skillmap);

            if (products != [])
            {
                let dist: string = (line[col.aw_dem_distr] as any);
                let distType: DistributionType = this.findDist(dist);
                let timeDistributionParameters: number[] = [];
                let tmp_timeDistributionParameters_Arr: string[] = line[col.aw_dem_distparam].toString().replace("[", "").replace("]", "").split(",");
                tmp_timeDistributionParameters_Arr.forEach(element => timeDistributionParameters.push(this.sim.simTiming.getInBaseTime((element as any) * 1, "days")));

                if (this.checkTimeDistParameters(distType, timeDistributionParameters) == true)
                {
                    let customerID: number = (line[col.aw_dem_custID] as any) * 1;
                    let custIndex = this.findCustomerByID(customerID, cusAr);
                    if (custIndex == -1)
                    {
                        MsgLog.logError("Customer not found! Can not create demand for unknown customer.", this, true);
                    }
                    else
                    {
                        let nextDate = (line[col.aw_dem_firstDate] as any) * 1;
                        nextDate = this.sim.simTiming.getInBaseTime(nextDate, "days"); //transformation in simtime

                        for (let index = 0; index < Math.floor(demandFactor); index++) //e.g. for factor of 2.6 -> add demand 2 times
                        {
                            let tmp_demand: Demand = new Demand(this.randomSIM, cusAr[custIndex!], products, nextDate, distType, timeDistributionParameters)
                            cusAr[custIndex].demands.push(tmp_demand);
                        }
                        //gamble for additional demand. 

                        if (this.randomSIM.random() < demandFactor % 1) //e.g. for factor of 1.6 -> 60% chance for additional demand
                        {
                            let tmp_demand: Demand = new Demand(this.randomSIM, cusAr[custIndex!], products, nextDate, distType, timeDistributionParameters)
                            cusAr[custIndex].demands.push(tmp_demand);
                        }

                        let tmp_demand: Demand = new Demand(this.randomSIM, cusAr[custIndex!], products, nextDate, distType, timeDistributionParameters)
                        cusAr[custIndex].demands.push(tmp_demand);
                        MsgLog.logDebug("Demand added for customerID: " + cusAr[custIndex].id + ", customerName: " + cusAr[custIndex].name, this, true);
                    }
                }
            }
        }
        return cusAr;

    }

    protected loadProducts(ptypes: Map<string, RouteSheet>): ProductH1[]
    {
        let products: Array<ProductH1> = [];
        let line;

        let liner = new lineByLine(Paths.H1.products);
        liner.next(); //Skip header
        let massID;

        let baseprice;
        let weightType;
        let ptype;
        let mass;
        while (line = liner.next())
        {
            line = (line.toString() as String).replace("\r", "").split(';');

            massID = (line[col.aw_prod_productID] as any) * 1;
            baseprice = (line[col.aw_prod_baseprice] as any) * 1;
            weightType = (line[col.aw_prod_weighType] as any);
            mass = (line[col.aw_prod_mass] as any);
            mass = mass.toString().replace(",", ".") * 1;
            ptype = ptypes.get(weightType);
            products.push(new ProductH1(weightType, ptype, mass, massID, baseprice));

            this.analytics.log(msgLog.types.debug, "Product: " + line[col.aw_prod_weighType] + " " + line[col.aw_prod_mass] + "g loaded", this, false, true);
        }

        return products;
    }

    /**
     * Requirment for this function: Each productID at each plant is only existing once. Otherwise there will be data loss!
     */
    protected loadSkillMap(machineFactor: { rem: Array<number>, add: Array<number> }): Map<string, RouteSheet>
    {
        let tempMap = new Map<string, RouteSheet>();
        let used = process.memoryUsage().heapUsed / 1024 / 1024;

        let prodType = "";
        let status = -1;
        let ways: transform_ways;


        let jsonFile = fs.readFileSync(Paths.H1.skillmap, 'utf8');

        jsonFile = jsonFile.slice(2); //There are two hashtags in the beginning of the file.
        let json = JSON.parse(jsonFile)
        json.forEach(element =>
        {
            prodType = element.productType;
            status = element.statusID * 1;
            let machineStr = element.possMachines.replace("[", "").replace("]", "").split(",");
            let machine: number[] = [];
            if (machineStr != "")
            {
                machineStr.forEach(element => 
                {
                    if (!machineFactor.rem.includes(element * 1))
                        machine.push(element * 1)
                    if (machineFactor.add.includes(element * 1))
                        machine.push(element * 100); //warning: this solution is only working for this particular case, because there are less than 100 machines. This is not a general solution
                }
                );
            }
            ways = element.nextStatus;
            tempMap = this.addToSkillmap(tempMap, prodType, status, machine, ways);
        });

        let used2 = process.memoryUsage().heapUsed / 1024 / 1024;
        MsgLog.log(msgLog.types.debug, `The skillmap uses approximately ${Math.round((used2 - used) * 100) / 100} MB`, this, false, false);

        return tempMap;
    }


    protected addToSkillmap(tempMap, prodType: string, status: number, machines: number[], ways: transform_ways)
    {
        if (tempMap.get(prodType) != undefined)
        {
            let pt = tempMap.get(prodType)!;
            if (pt.posMachines.get(status) != undefined)
                this.analytics.logError("Fehler: SKillmap Eintrag doppelt!", this, true);
            pt.posMachines.set(status, machines);

            pt.setMap(status, ways);
        }
        else
        {
            let pt = new RouteSheet(this.randomSIM, prodType);
            pt.posMachines.set(status, machines);
            pt.setMap(status, ways);
            tempMap.set(prodType, pt);
        }
        return tempMap;

    }

    protected loadMachines(productionSystem: ProductionSystemH1, machineFactor: { rem: Array<number>, add: Array<number> })
    {
        let used = process.memoryUsage().heapUsed / 1024 / 1024;

        let liner = new lineByLine(Paths.H1.machines);
        let line;
        line = liner.next();
        line = liner.next();
        line = liner.next(); //Headline
        let headline: string[] = line.toString().replace("\r", "").split(';');
        let id = -1;
        let name = "";
        let minweight: number;
        let maxweight: number;
        let parallel: boolean;
        while (line = liner.next())
        {
            let ProductionTime = new Map<number, number>();
            line = line.toString().replace("\r", "").split(';');



            id = line[col.aw_mach_id] * 1;

            if (machineFactor.rem.includes(id))
                continue;

            name = line[col.aw_mach_name];
            minweight = line[col.aw_mach_minweight].replace(",", ".") * 1;
            maxweight = line[col.aw_mach_maxweight].replace(",", ".") * 1;
            parallel = (line[col.aw_mach_parallel] == "true");

            for (let i = col.aw_mach_prodT_firstColumn; i <= col.aw_mach_prodT_lastColumn; i++)
            {
                let prodID: number = Number(headline[i]);
                if (line[i] != "")
                {
                    ProductionTime.set(prodID * 1, line[i].replace(",", ".") * 1);
                }
            }
            productionSystem.addFacility(this.sim, id, name, minweight, maxweight, parallel, ProductionTime);

            if (machineFactor.add.includes(id))
            {
                productionSystem.addFacility(this.sim, id * 100, name, minweight, maxweight, parallel, new Map(ProductionTime)); //warning: this solution is only working for this particular case, because there are less than 100 machines. This is not a general solution
            }
        }

        let used2 = process.memoryUsage().heapUsed / 1024 / 1024;
        MsgLog.log(msgLog.types.debug, `The skillmap uses approximately ${Math.round((used2 - used) * 100) / 100} MB`, this, false, false);

    }

    async run()
    {

        this.sim.simTime = 0;
        this.sim.queue = new PQueue();
        this.sim.endTime = 0;

        this.productionSystem.register();
        this.productionNetwork.registerInitialSimEvent();
        if (this.config.envConfig.traffic > 0)
        {
            this.loadTraffic(this.config.envConfig.traffic)
        }
        await this.sim.simulate(this.config.envConfig.totalSimTime, undefined, false);
        this.productionNetwork.finish();
        this.orchestrator?.clean();
        this.analytics.dbcon.syncDataWithDB();
    }

    pause()
    {
        this.sim.pause();
    }

    continue()
    {
        this.sim.continue();
    }

    stop()
    {
        this.sim.stop();
    }

}
