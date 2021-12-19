/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


/**
 * This enum is used to configure the right column ids for reading in CSV files
 */
export enum col
{
    //Startingmachinetypes columns
    facilitySite = 2,
    facilityWP = 4,
    ressourceGroupInvestitionCost = 5,

    //Skillmap columns
    skillPartID = 1,
    skillSite = 2,
    skillWType = 3,
    skillWP = 4,
    skillRec = 5,

    //DistributionAllNetwork
    disAllPart = 1,
    disprob = 2,
    disAll = 3,

    //Distribution
    dispart = 1,
    dis = 3,
    disProductType = 4,
    disProductPrice = 5,

    //ProductionRatePerMaterials
    prPart = 0,
    prWorkcenterType = 1,
    prProductionRate = 4,


    //Order
    oamount = 0,
    oprodId = 1,
    odueDate = 2,

    //RevenuePerPart
    RPPpartID = 1,
    RPPSite = 2,
    RPPRevenue = 3,

    //Customers
    KundenID = 0,
    KundenA = 1,
    KundenB = 2,
    KundenD_ = 3,
    KundenV = 4,


    //____________ AW ________________
    // Product
    aw_prod_productID = 0,
    aw_prod_baseprice = 1,
    aw_prod_weighType = 2,
    aw_prod_mass = 3,
    //skillmap
    aw_pType = 1,
    aw_status = 2,
    aw_machines = 3,
    aw_ways = 5,
    //machines
    aw_mach_id = 2,
    aw_mach_name = 1,
    aw_mach_minweight = 3,
    aw_mach_maxweight = 4,
    aw_mach_parallel = 5,
    aw_mach_prodT_firstColumn = 6,
    aw_mach_prodT_lastColumn = 175,

    //demands
    aw_dem_custID = 0,
    aw_dem_custName = 1,
    aw_dem_prod = 2,
    aw_dem_distr = 3,
    aw_dem_distparam = 4,
    aw_dem_firstDate = 5,

    //customers
    aw_cust_custID = 0,
    aw_cust_name = 1,
    aw_cust_a = 3,
    aw_cust_b = 4,
    aw_cust_d_ = 5,
    aw_cust_v = 6,
    
    //traffic

    aw_traf_prodID = 0,
    aw_traf_interarrival = 2
}