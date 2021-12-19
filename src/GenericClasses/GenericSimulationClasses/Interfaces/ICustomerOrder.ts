/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import ResourceV2 from "../../../Environment/V2/ProductionSystemModule/ResourceV2";
import IProduct from "./IProduct";
import IProductionOrder from "./IProductionOrder";

/**
 * This interface defines a customer order. It is created based on a demand and is existing to fulfill the demand.
 */
export default interface ICustomerOrder
{
    /**
     * unique id of the order
     */
    id: number;

    /**
     * Products to produced as ordered by customer
     */
    products: IProduct[];

    /**
     * The productions orders breaking down the customer order into single product orers of same due date/time
     */
    ProductionOrders: IProductionOrder[];

    /**
     * Time stamp when this customer order was created
     */
    timeOfCreation: number;

    /**
     * due time of the order
     */
    dueTime: number;

    /**
     * Date when this order is due
     */
    dueDate: number;

    /**
     * Time when production was finsihed
     */
    productionEnd: number

    /**
     * if order was not given after negotiation
     */
    notOrderedByCustomer: boolean;

    /**
     * the surcharge relative to the base price. Will be multiplied with the base price to get the absoluteSurcharge
     */
     relativePriceSurcharge: number;

    /**
     * full price surcharge for the complete order amount; addable to the base price to get the total price
     */
    fullSurcharge: number;

    /**
     * Includes the margin of an order (amount * price) minus delivery date deviation cost
     */
    baseRevenue: number;

    /**
     * get the total revenue of an order. This is the value the company can have as profit. 
     * It is the addition of baseRevenue with fullSurcharge
     */
    totalRevenue: number;

}