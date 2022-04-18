/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import IDemand from "./IDemand";
import ICustomerOrder from "./ICustomerOrder";

/**
 * This interface design which minimum function must be implemented in order to work in the standardized model.
 */
export default interface IProductionSystem
{
    /**
     * Create an environment specific order template which implements the ICustomerOrder and is based on the standardized IDemand
     * @param demand the IDemand object to create the roder from
     */
    createOrderTemplate(demand: IDemand): ICustomerOrder;
    
    /**
     * Takes an order, plans it and triggers manufacturing and delivery. 
     * @param order the order to produce
     */
    plan(order: ICustomerOrder);
    
    /**
     * This function is called by production network to tell the production system to log data. This has no interrelation with the model but is just used for data documentation
     * @param order 
     */
    writeKPIsToReport(order: ICustomerOrder);

    /**
     * Reset the "used" flag of all machines to start a new section
     * @param resetMachine 
     */
    resetMachineFlagsKPI(resetMachine: boolean);
}