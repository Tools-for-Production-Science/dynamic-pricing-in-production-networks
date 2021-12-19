/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer (First version)

Copyright (c) 2021 Festo SE & Co. KG 

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { Sim, Random } from "simts";
import lineByLine = require('n-readlines');
import { EnvironmentConfiguration } from "../../SystemManagement/Configuration/EnvironmentConfiguration";
import { Analytics } from "../../SystemManagement/Analytics/Analytics";
import { col } from "../../SystemManagement/Configuration/DataformatEnum";
import MsgLog from "../../SystemManagement/MessengingSystem/MsgLog";
import msgLog from "../../SystemManagement/MessengingSystem/MsgLog";
import IEngine from "../../GenericClasses/GenericSimulationClasses/Interfaces/IEngine";
import { ProductionNetwork } from "../../GenericClasses/GenericSimulationClasses/ProductionNetwork";
import Paths from "../../SystemManagement/Configuration/Paths";
import { ProductionSystemV2 } from "./ProductionSystemModule/ProductionSystemV2";
import ProductV2 from "./ProductionNetworkModule/ProductV2";
import { ExperimentSettings } from "../../SystemManagement/Configuration/ExperimentSettings";
import Orchestrator from "../../GenericClasses/GenericMLClasses/Orchestrator";
import Environment from "../../GenericClasses/GenericMLClasses/Environment";
import Customer from "../../GenericClasses/GenericSimulationClasses/Customer";
import DemandV2 from "./ProductionNetworkModule/DemandV2";
import IProduct from "../../GenericClasses/GenericSimulationClasses/Interfaces/IProduct";


export class EngineV2 implements IEngine
{

    sim = new Sim(); //Instanziert neue Simulation    

    productionNetwork: ProductionNetwork;
    productionSystem: ProductionSystemV2;

    orchestrator: Orchestrator;
    randomSIM: Random;
    randomAI: Random;

    config: ExperimentSettings;
    analytics: Analytics;

    /**
     * This is an old artefact and may not be needed anymore (check usage and effect in experiments)
     */
    numberOfProducts = 0;

    maximumMeanOfOrderDuration = 0;
    maximumVarianceOfOrderDuration = 0;

    /**
     * Setup an engine instance for the v2 environment
     * @param config the configuration of the simulation experiment
     * @param analytics a refernece to an analytics object to document and analyze data
     */
    constructor(config: ExperimentSettings, analytics: Analytics)
    {

        this.randomSIM = new Random(config.seed);
        this.randomAI = new Random(config.seed);

        this.sim.simTiming.setTwoShiftModel(true);

        this.config = config; 

        this.analytics = analytics; //this is critical to have here

        this.productionSystem = new ProductionSystemV2(this);
        this.initializeProductionSystem(this.productionSystem);
        let products = this.loadProducts(this.productionSystem);
        let customers = this.createPopulationOfCustomers(products, this.config.envConfig);
        this.productionNetwork = new ProductionNetwork(this, this.productionSystem, customers);

        this.sim.addEntity(this.productionNetwork);
        this.sim.addEntity(this.productionSystem); 

        this.registerStartEvents();

        let env = new Environment();
        msgLog.log(msgLog.types.debug, 'environment initialized', this)

        env.registerComponent(this.productionNetwork);
        env.registerComponent(this.productionSystem);

        env.setReady();//Here every possible state input is set
        this.orchestrator = new Orchestrator(env, config, this.sim, this.randomAI, this.analytics)
    }

    private initializeProductionSystem(productionSystem: ProductionSystemV2)
    {
        this.loadSkillMap(productionSystem);
        this.createInitialManufacturingSetup(productionSystem);
        this.loadProductionDurationPerPartAndMachine(productionSystem);
        this.loadRevenueRatePerUnit(productionSystem);
        this.loadAllResourceTypes(productionSystem);
        this.loadAllResources(productionSystem);
    }

    private loadProducts(productionSystem): ProductV2[]
    {
        let products: Array<ProductV2> = [];
        let line;
        let disInf; //saves all parameters of the distribution
        let distributionName;
        let disProductType; //saves if a product is traffic or not
        let price;
        let liner = new lineByLine(Paths.V2.Probabilities);
        liner.next(); //Skip header
        while (line = liner.next())
        {
            line = (line.toString() as String).replace("\r", "").split(';');


            //Save if a product is traffic or not
            if (line.length >= 5)
            {
                disProductType = line[col.disProductType].toString() as String
            } else
            {
                disProductType = null
            }
            if (line.length >= 6)
            {
                price = line[col.disProductPrice].toString() * 1
            } else
            {
                price = null
            }

            //Save the distribution data of a product
            disInf = (line[col.disAll].toString() as String).replace(/['()]/g, "",).split(',');
            //Save the distributionName, the rest of disInf contains the distribution parameters
            distributionName = disInf.shift();
            disInf.shift(); //Delete p-Value
            
            if (disProductType == "Traffic")
            {
                if (this.config.envConfig.traffic < this.randomSIM.random())
                {
                    continue;
                }
            }
            let newp = new ProductV2((line[col.disAllPart] as any) * 1, (line[col.disprob] as any) * 1, distributionName, disInf, disProductType, price, this.randomSIM)
            products.push(newp);

            //On which machines can the product be produced
            let machinelist = new Array<string>();

            productionSystem.skillMap.get(newp.id)?.forEach(machine =>
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
            
            let maxProductionDuration = productionSystem.getMaximumProductionDurationFromListOfMachines(machinelist, newp);
            newp.baseProductionDuration = maxProductionDuration;




            let m = newp.getMean() * maxProductionDuration;
            if (m > this.maximumMeanOfOrderDuration)
            {
                this.maximumMeanOfOrderDuration = m;
            }

            //Maximum Variance overall products -->Resulting distribution is not poisson distributed, but this doesn't matter for calculating the variance
            //https://math.stackexchange.com/questions/1640151/what-is-distribution-of-poisson-multiplied-by-positive-constant
            let v = newp.getStd() * Math.sqrt(maxProductionDuration);
            if (v > this.maximumVarianceOfOrderDuration)
            {
                this.maximumVarianceOfOrderDuration = v;

            }
        }

        this.numberOfProducts = products.length;

        return products;
    }

    /**
     * Add all starting machines to manufacturing
     */
    private createInitialManufacturingSetup(productionSystem: ProductionSystemV2)
    {
        let liner = new lineByLine(Paths.V2.startingMachineTypes); 
        let line;
        line = liner.next(); //Headline
        while (line = liner.next())
        { 
            line = (line.toString() as String).replace("\r", "").split(';'); 
            productionSystem.addFacility(this.sim, line[col.facilitySite], line[col.facilityWP], line[col.ressourceGroupInvestitionCost] * 1.0); 
        }
    }

    /**
     * Requirment for this function: Each productID at each plant is only existing once. Otherwise there will be data loss!
     */
    private loadSkillMap(productionSystem: ProductionSystemV2)
    {
        let used = process.memoryUsage().heapUsed / 1024 / 1024;
        

        let liner = new lineByLine(Paths.V2.materialsSkillmap); 
        let line;
        line = liner.next(); //Headline
        while (line = liner.next())
        {
            line = line.toString().replace("\r", "").split(';');
            productionSystem.addToSkillmap(line);
        }

        let used2 = process.memoryUsage().heapUsed / 1024 / 1024;
        MsgLog.log(msgLog.types.debug, `The skillmap uses approximately ${Math.round((used2 - used) * 100) / 100} MB`, this, false, false);

    }

    private registerStartEvents()
    {
        this.productionNetwork.registerInitialSimEvent();
        this.productionSystem.registerTimeBasedEvents();
    }

    private loadAllResourceTypes(productionSystem: ProductionSystemV2)
    {
        let allResourcesTypesArray: Array<String> = [];

        productionSystem.sites.forEach((site) =>
        {
            site.forEach((machinegroupname) =>
            {
                allResourcesTypesArray.push(machinegroupname.name)
            })
        })
        productionSystem.allResourceTypes = Array.from(new Set(allResourcesTypesArray))

    }

    private loadAllResources(productionSystem: ProductionSystemV2)
    {
        productionSystem.sites.forEach((site) =>
        {
            site.forEach((machinegroupname) =>
            {
                machinegroupname.Machines.forEach((machine) =>
                {
                    productionSystem.allResourceNames.push(machine.parent.name);
                    productionSystem.allResourceIds.push(machine.machineID)
                })
            })
        })
    }

    private loadProductionDurationPerPartAndMachine(productionSystem: ProductionSystemV2)
    {
        let liner = new lineByLine(Paths.V2.productionRatePerPartAndMachine);
        let line;
        line = liner.next(); //Headline
        while (line = liner.next())
        {
            line = line.toString().replace("\r", "").split(';');
            productionSystem.addToProductionRateMap(line);
        }
    }
    private loadRevenueRatePerUnit(productionSystem: ProductionSystemV2)
    {
        let liner = new lineByLine(Paths.V2.revenuePerPart);
        let line;
        line = liner.next(); //Headline
        while (line = liner.next())
        {
            line = line.toString().replace("\r", "").split(';');
            productionSystem.addToRevenuePerPart(line);
        }
    }


    /**
     * Creates the customer population based on configuration
     * TODO FO DONE
     * TODO FO FOLLOW Dummy Customers to real customers, Bestimme für jedes Produkt welchen Kunden es zugeordnet wird.
     * @param products the current products possible to order
     * @param config config of the environment
     */
    private createPopulationOfCustomers(products: IProduct[], config: EnvironmentConfiguration): Customer[]
    {

        let customers = new Array<Customer>();

        let customerDemands = this.drawCustomersForProducts(config.customerAmount, products);

        let customerProfiles = new Map<number, {}>()

        let liner = new lineByLine(Paths.V2.customerPreferences);
        let line;
        line = liner.next(); //Headline
        while (line = liner.next())
        {
            line = line.toString().replace("\r", "").split(';');
            let dict = {
                "a": line[col.KundenA] * 1,
                "b": line[col.KundenB] * 1,
                "d_": line[col.KundenD_] * 1,
                "v": line[col.KundenV] * 1
            }
            customerProfiles.set(line[col.KundenID] * 1, dict)

        }

        for (let i = 0; i < config.customerAmount; i++)
        {
            let index = (i % customerProfiles.size) + 1

            let a = customerProfiles.get(index)!["a"]
            let b = customerProfiles.get(index)!["b"]
            let d_ = customerProfiles.get(index)!["d_"]
            let v = customerProfiles.get(index)!["v"]

            let tmpCustomer = new Customer(this, this.config.envConfig, i, this.randomSIM, a, b, d_, v);
            let tmpDemand;
            customerDemands[i].forEach(val =>
            {
                tmpDemand = new DemandV2(this, val, this.randomSIM, this.randomSIM.distribution.exponential, [0, this.sim.simTiming.getInBaseTime((val as ProductV2).prob, "minutes")]); //order every 7 days mean
                tmpCustomer.demands.push(tmpDemand);
            })

            customers.push(tmpCustomer);
        }

        return customers;
    }
    /**
       * Create demands for customers so that each product has at least one customer. It can happen that a customer has no product
       * @param customerAmount Numer of customers the protfolios shall be generated
       * @param products Array of products the demand shall be created for
       * @returns demands
       */
    private drawCustomersForProducts(customerAmount, products: Array<IProduct>): Array<IProduct[]>
    {
        let customerPortfolios = new Array<IProduct[]>(customerAmount);
        let notDrawnCustomers = Array.from(Array(customerAmount).keys())


        for (let c = 0; c < customerAmount; c++)
        {
            customerPortfolios[c] = [];
        }

        let counterN = 0;

        for (let index = 0; index < products.length; index++)
        {
            let n = 0;
            if ((index == products.length - 1) && (counterN < customerAmount))
            {
                //Test if all customers have been assigned to a product
                n = customerAmount - counterN
            } else
            {
                n = 1 + Math.floor(this.randomSIM.random() * customerAmount)
            }
            products[index].numCustomers = n;
            counterN = counterN + n;

            let customerRange = Array.from(Array(customerAmount).keys());//Array with all customerIDs



            for (let i = 1; i <= n; i++)
            {
                if (notDrawnCustomers.length > 0)
                {
                    //Only if there are customers that haven´t beeen drawn

                    let idInArray = Math.floor(notDrawnCustomers.length * this.randomSIM.random()); //Random ArrayID for NotDrawnCustomers
                    let customerID = notDrawnCustomers[idInArray];//Determine customerID
                    notDrawnCustomers.splice(idInArray, 1) //Delete Customer from NotDrawnCustomers List



                    let idInArrayCustomerRange = customerRange.indexOf(customerID) //Determine ArrayID of Customer in customerRange
                    customerRange.splice(idInArrayCustomerRange, 1) //Delete Customer from CustomerRange
                    customerPortfolios[customerID].push(products[index]) //Push Product in portfolio of customer



                } else
                {
                    let idInArray = Math.floor(customerRange.length * this.randomSIM.random()); //Pick random customer
                    let customerID = customerRange[idInArray];
                    customerRange.splice(idInArray, 1)//Delete customerID from possible customerIDs
                    customerPortfolios[customerID].push(products[index])//Add Products to selected Customer Portfolios
                }

            }
        }
        return customerPortfolios;
    }

    /**
     * Run the simulation experiment
     */
    async run()
    {
        await this.sim.simulate(this.config.envConfig.totalSimTime, undefined, false);
        this.orchestrator?.clean();
        this.analytics.dbcon.syncDataWithDB(); //make sure to save all buffered data to db after simulaton finsihed
    }

    pause()
    {
        this.sim.pause();
    }

    continue()
    {
        this.sim.continue()
    }

    stop()
    {
        this.sim.stop();
    }


    
}