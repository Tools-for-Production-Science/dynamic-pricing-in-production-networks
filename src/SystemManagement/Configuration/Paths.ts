/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

/**
 * Static paths to use for different environments
 */
const Paths = {
    V2: {
        //Paths are always relative to execution path of node! -> This is normally the engine folder
        startingMachineTypes: './csv/V2/startingMachineTypesFINAL.csv',
        Probabilities: './csv/V2/DistributionAllNetworkFINAL.csv',
        materialsSkillmap: './csv/V2/materialsSkillmapFINAL.csv',
        productionRatePerPartAndMachine: './csv/V2/productionRatePerPartAndMachineFINALAverage.csv',
        revenuePerPart: './csv/V2/RevenuePerUnitFINAL.csv',
        testingConfig: './testConfigV2.json',
        customerPreferences: './csv/V2/CustomersFINAL.csv',
    },

    H1: {
        products: './csv/H1/productsH1.csv',
        skillmap: './csv/H1/skillmapH1.txt',
        machines: './csv/H1/machinesH1.csv',
        demands: './csv/H1/demandsH1.csv',
        customers: './csv/H1/customersH1.csv',
        traffic: './csv/H1/traffic.csv'
    }

}

export default Paths;