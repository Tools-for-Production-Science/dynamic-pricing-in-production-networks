/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Alexander Werle, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { Random } from "simts";
import MsgLog from "../../SystemManagement/MessengingSystem/MsgLog";

export default class RouteSheet
{
    name: String;
    map = new Map<number, transform_ways>(); // @todo_aw: Wieso einfach "map" genannt?
    posMachines = new Map<number, number[]>();
    random: Random;

    /**
     * This class implements a route sheet to guide products through the production process. It shows the next state given a current state. The next state can be based on probabilities (see Markov process).
     * @param random 
     * @param name 
     */
    constructor(random, name: String = "")
    {
        this.random = random;
        this.name = name;
    }
    /**
     * Add a state and the possible next state
     * @param state 
     * @param tr 
     */
    setMap(state: number, tr: transform_ways)
    {
        if (this.map.get(state) != undefined)
            MsgLog.logError("Fehler: SKillmap Eintrag doppelt!", this, true);

        let totalProb = 0;
        tr.forEach((element) =>
        {
            totalProb += element.prob;
        });

        let temp = 0;
        let cumulative = tr.map((val, ind, ar) =>
        {
            val.prob = val.prob + temp;
            temp = val.prob;
            return val;
        });

        let sort = cumulative.sort((a, b) => { return a.prob - b.prob })
        this.map.set(state, sort);
    }
    /**
     * get the next state given a state. The next state is drawn based on given probabilities
     * @param cur_state 
     * @returns 
     */
    getNextState(cur_state): number
    {
        let decider = this.map.get(cur_state);
        let rnd = this.random.random();
        let res = -10;

        decider!.some((element) =>
        {
            if (element.prob > rnd)
            {
                res = element.nextState;
                return res;
                //return true; //ALTE VERSION FS
            }
        });

        if (res == -10)
            MsgLog.logError("Fehler! NextState nicht gefunden", this, true);

        return res;
    }
    /**
     * Returns all possible machines to handle a product in a given state
     * @param cur_state 
     * @returns 
     */
    getMachines(cur_state): number[]
    {
        // Gibt weiterhin die Maschinen aus, aber nur für den Produkttyp
        // Aus dem Manufacturing wird die get Methode des Produkts aufgerufen,
        // diese ruft dann die Methode hier auf
        return this.posMachines.get(cur_state)!;

    }
}
/**
 * A simple map to implement all possible next states and their probabilities
 */
export type transform_ways = Array<
    {
        prob: number;
        nextState: number;
    }
>
