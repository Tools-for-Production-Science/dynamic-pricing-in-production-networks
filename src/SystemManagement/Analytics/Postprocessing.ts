import { ProductionSystemH1 } from "../../Environment/H1/ProductionSystemModule/ProductionSystemH1";
import { ProductionSystemV2 } from "../../Environment/V2/ProductionSystemModule/ProductionSystemV2";
import IEngine from "../../GenericClasses/GenericSimulationClasses/Interfaces/IEngine";
import { expDB } from "../expDB";
import { Analytics } from "./Analytics";
import DataStream from "./DataStream";

export default class Postprocessing
{
    processedKPI!: DataStream;
    storyBoardWriter!: DataStream;
    /**
     * This class implements a postprocessing. It generates KPIs for number of requests, profit, delays, declined order, lead time deviation, service level and unused capacities.
     */
    constructor(public analytics: Analytics, public expid: number, public dbcon: expDB, public engine: IEngine)
    { }

    /**
     * Postprocess KPIs for H1 Case
     * @returns 
     */
    postProcessingH1()
    {
        let envConfig = this.engine.config.envConfig;

        let no_orders = (this.engine.productionSystem as ProductionSystemH1).finishedCustomerOrderCounter;
        let no_nullOrders = this.engine.productionNetwork.counterNullOrders;
        let no_lateOrders = (this.engine.productionSystem as ProductionSystemH1).counterDelayedCustomerOrders;
        let share_declinedOrders = no_nullOrders/no_orders
        let servicegrad = (no_orders - no_nullOrders - no_lateOrders)/(no_orders - no_nullOrders)
        let cum_revenue = (this.engine.productionSystem as ProductionSystemH1).overallRevenue;
        let usage = 0;
        let usageStd = 0;

        return {
            expid: this.expid, //ok
            UseAI: envConfig.useAI, //ok
            seed: this.engine.config.seed, //ok
            traffic: envConfig.traffic, //ok
            "Anzahl eingegangene Aufträge": no_orders, //ok
            'Abgelehnte Aufträge': no_nullOrders, //ok
            'Liefertermineinhaltung': servicegrad, //ok
            'Verspätungen': no_lateOrders, //ok
            'Service Level': (1-share_declinedOrders), //unclear
            'Mittlerer Gewinn pro Auftrag': cum_revenue/no_orders, //ok
            'Gewinn': cum_revenue, //ok         
        };
        // 'Liefertermineinhaltung':servicegrad,'Verspätungen':no_lateOrders,'Service Level':(1-share_declinedOrders) , 'Mittlere Verspätung':avg_dueDateDeviation, 'Maximale Verspätung':max_tardiness, 'Mittlerer Gewinn pro Auftrag':avg_revenue,'Gewinn':cum_revenue})
    }

    postProcessingH1Limit()
    {
        let envConfig = this.engine.config.envConfig;

        let no_orders = (this.engine.productionSystem as ProductionSystemH1).finishedCustomerOrderCounter;
        let no_nullOrders = this.engine.productionNetwork.counterNullOrders;
        let no_lateOrders = (this.engine.productionSystem as ProductionSystemH1).counterDelayedCustomerOrders;
        let share_declinedOrders = no_nullOrders/no_orders
        let servicegrad = (no_orders - no_nullOrders - no_lateOrders)/(no_orders - no_nullOrders)
        let cum_revenue = (this.engine.productionSystem as ProductionSystemH1).overallRevenue;
        let earlines = (this.engine.productionSystem as ProductionSystemH1).earlinessSum;
        let tardiness = (this.engine.productionSystem as ProductionSystemH1).tardinessSum;
        let duedeviation = Math.abs(earlines)+Math.abs(tardiness);

        return {
            expid: this.expid, //ok
            UseAI: envConfig.useAI, //ok
            seed: this.engine.config.seed, //ok
            traffic: envConfig.traffic, //ok
            "Anzahl eingegangene Aufträge": no_orders, //ok
            'Abgelehnte Aufträge': no_nullOrders, //ok
            'Liefertermineinhaltung': servicegrad, //ok
            'Verspätungen': no_lateOrders, //ok
            'Service Level': (1-share_declinedOrders), //unclear
            'Mittlerer Gewinn pro Auftrag': cum_revenue/no_orders, //ok
            'Verfrühung (Summe)': earlines,
            'Verspätung (Summe)':tardiness,
            'Lieferterminabweichung': duedeviation, 
            'Gewinn': cum_revenue, //ok         
        };
    }

    /**
     * Postprocess KPIs for V2 case
     */
    postprocessingV2()
    {
        this.processedKPI = this.analytics.createDataStreamWriter("ProcessedKPI");
        let sql = `\
        SELECT * FROM ${this.dbcon.tableNames.experimentData} WHERE expid = ${this.expid} AND label = 'Year' ; `
        let res = this.dbcon.db.prepare(sql).all();
        let years = res.map((val) => { return val["data"] * 1; });
        let max_year = years.reduce((max, v) => max >= v ? max : v, -Infinity)
        //let max_year = Math.max(...years); Problem -> https://stackoverflow.com/questions/42623071/maximum-call-stack-size-exceeded-with-math-min-and-math-max


        let repid = this.analytics.createNewReport("FinalKPIs");
        this.storyBoardWriter = this.analytics.createVisualisationWriter("KPIs", "story", repid);



        let lastIndex = 0;


        for (let i = 1; i <= max_year; i++)
        {
            this.storyBoardWriter.write("Jahr ", (i));
            let iString = i.toString() + '.0'

            sql = `\
            SELECT * FROM ${this.dbcon.tableNames.experimentData} WHERE expid = ${this.expid} AND label = 'Year' AND data = '${iString}' ; `
            let ordersInYearMap = this.dbcon.db.prepare(sql).all();
            let ordersInYearArray = ordersInYearMap.map((val) => { return val["data"] * 1; });
            let maxOrdersInYear = ordersInYearArray.length;

            this.storyBoardWriter.write('Anzahl eingegangene Aufträge', maxOrdersInYear);
            this.processedKPI.write("Anzahl eingegangene Aufträge", maxOrdersInYear);

            let revenue = this.writeSumKPIDataToStoryBoard('Revenue', 'Gewinn', lastIndex, maxOrdersInYear + lastIndex, i)
            this.processedKPI.write("Gewinn", revenue);

            let rew = this.writeSumKPIDataToStoryBoard('kiReward', 'Reward_AVG', lastIndex, maxOrdersInYear + lastIndex, i)
            this.processedKPI.write("Reward_AVG", rew);

            let nullorders = this.writeSumKPIDataToStoryBoard('DeclinedOrder', 'Abgelehnte Aufträge', lastIndex, maxOrdersInYear + lastIndex, i)
            this.processedKPI.write("Abgelehnte Aufträge", nullorders);

            let deviations = this.writeSumKPIDataToStoryBoard('Deviation', 'Lieferterminabweichungen', lastIndex, maxOrdersInYear + lastIndex, i)

            let delays = this.writeSumKPIDataToStoryBoard('Delay', 'Verspätungen', lastIndex, maxOrdersInYear + lastIndex, i)

            let servicegrad = (maxOrdersInYear - delays - nullorders) / (maxOrdersInYear - nullorders);

            if (Number.isNaN(servicegrad))
            {
                this.storyBoardWriter.write("Liefertermineinhaltung", 0);
                this.processedKPI.write("Liefertermineinhaltung", 0);

            } else
            {
                this.storyBoardWriter.write("Liefertermineinhaltung", servicegrad);
                this.processedKPI.write("Liefertermineinhaltung", servicegrad);

            }

            let serviceLevel = (maxOrdersInYear - nullorders) / (maxOrdersInYear)
            this.storyBoardWriter.write("Service Level", serviceLevel);

            let unusedmachines = this.writeMinKPIDataToStoryBoard('UnusedMachines', 'Unbenutzte Maschinen', lastIndex, maxOrdersInYear + lastIndex)

            lastIndex += maxOrdersInYear

            this.storyBoardWriter.write('', '');
        }
    }

    private writeSumKPIDataToStoryBoard(KPIName: String, Auswertungsname: string, startIndex: number, endIndex: number, year: number): number
    {
        let sql = `\
        SELECT * FROM ${this.dbcon.tableNames.experimentData} WHERE expid = ${this.expid} AND label = '${KPIName}' ; `

        let kpidata = this.dbcon.db.prepare(sql).all();
        let mapdatatoarray = kpidata.map((val) => { return val["data"] * 1; });

        mapdatatoarray = mapdatatoarray.slice(startIndex, endIndex)

        let data = mapdatatoarray.reduce((a, b) => { return a + b; })

        if (KPIName == "Revenue")
        {
            for (let i = 0; i < (Math.floor(year / this.engine.config.envConfig.amountOfYearsForUnusedMachineKPI)) - (Math.floor((year - 1) / this.engine.config.envConfig.amountOfYearsForUnusedMachineKPI)); i++)
            {
                let revenueFromSavedMachine = (this.engine.productionSystem as ProductionSystemV2).revenueMachineSavedArray.pop()
                if (revenueFromSavedMachine != undefined)
                {
                    data = data + revenueFromSavedMachine!
                }

            }

        }
        this.storyBoardWriter.write(Auswertungsname, data);


        return data;
    }

    private writeMinKPIDataToStoryBoard(KPIName: String, Auswertungsname: string, startIndex: number, endIndex: number): number
    {
        let sql = `\
            SELECT * FROM ${this.dbcon.tableNames.experimentData} WHERE expid = ${this.expid} AND label = '${KPIName}' ; `
        let kpidata = this.dbcon.db.prepare(sql).all();
        let mapdatatoarray = kpidata.map((val) => { return val["data"] * 1; });

        mapdatatoarray = mapdatatoarray.slice(startIndex, endIndex)

        let data = mapdatatoarray.reduce((min, v) => min <= v ? min : v, Infinity);
        //let data = Math.min(...mapdatatoarray) Problem siehe https://stackoverflow.com/questions/42623071/maximum-call-stack-size-exceeded-with-math-min-and-math-max
        this.storyBoardWriter.write(Auswertungsname, data);
        return data;
    };



}

