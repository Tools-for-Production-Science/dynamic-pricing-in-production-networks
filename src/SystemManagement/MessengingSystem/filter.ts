/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

/**
 * List of names of classes from which debug messages should not be delivered. 
 */
let blacklist =  //Neu: Damit lassen sich Nachrichten von Klassen filtern! Einfach aus und einkommentieren umd den FIlter einzustellen
    [
        "ProductionSystemV2",
        "EngineV2",
        "EngineH1",
        "MarketSimulation",
        "Agent",
        "Customer",
        "Function",
        "ProductionNetwork",
        "Environment",
        "ProductionControlV2",
        "Orchestrator",
        "Analytics",
        "ProductionSystemH1",
        "ProductionControlH1"
    ];

/**
 * Change the blacklist to a new array
 * @param list An Array of strings
 */
function changeBlacklist(list: Array<string>)
{
    blacklist = list;
}

export { blacklist, changeBlacklist };