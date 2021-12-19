/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import ICustomerOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/ICustomerOrder";
import IProductionOrder from "../../../GenericClasses/GenericSimulationClasses/Interfaces/IProductionOrder";
import ProductH1 from "../ProductionNetworkModule/ProductH1";

export default class ProductionOrderH1 implements IProductionOrder {
    id = -1
    dueDate: number;
    /**
     * the status code of the order. controls the process flow
     */
    status: number;
    product: ProductH1;
    timeOfCreation: number;
    plannedDate: number;
    productionStart: number;
    /**
     * temporarly saves the start of a process. This is relevant for the documentation of the processHistory
     */
    productionStartForActiveState:number = 0;
    productionEnd: number;
    customerOrder: ICustomerOrder;
    /**
     * Documents the complete process history for this production order. Every product starts with status code 0
     */
    processHistory = [{'status':0,'machine':0,'start':0,'end':0}]
    traffic:boolean;

    /**
     * Creates a new production order. A production order splits up a customer order into n different entities to have one object per product type. The customer order is finsihed after all production orders are finsihed
     * @param dueDate the date when the order must be finished
     * @param product the product to produce
     * @param timeOfCreation a time stamp when the order was created
     * @param customerOrder a reference to the linked customer order 
     * @param traffic wheater the order is only traffic
     */
    constructor(id:number, dueDate: number, product:ProductH1, timeOfCreation:number,customerOrder:ICustomerOrder,traffic)
    {
        this.dueDate = dueDate;
        this.status = 0;
        this.product = product;
        this.timeOfCreation = timeOfCreation;
        this.plannedDate = -1;
        this.productionStart = timeOfCreation;
        this.productionEnd = -1;
        this.customerOrder = customerOrder;
        this.traffic = traffic;
        this.id = id;
    }

    /**
     * add an entry in the process history
     * TODO: integrate the status stamps here as well
     * @param resourceID the machine/resource the order was processed by
     * @param endTime the time when the process was finsihed
     */
    addStatus(resourceID:number,endTime:number)
    {
        this.processHistory.push({'status':this.status,'machine':resourceID,'start':this.productionStartForActiveState,'end':endTime});
    }
}