/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import Orchestrator from "../../GenericMLClasses/Orchestrator";
import { Analytics } from "../../../SystemManagement/Analytics/Analytics";
import { ExperimentSettings } from "../../../SystemManagement/Configuration/ExperimentSettings";
import { Random, Sim } from "simts";
import IProductionSystem from "./IProductionSystem";
import { ProductionNetwork } from "../ProductionNetwork";

/**
 * This interface the standard of an engine. The engine provides functions to load data, setup the environment and AI.
 * It is the core entry point of an experiment run and the central turnstile to connect all components with each other
 */
export default interface IEngine
{

    //Properties
    /**
     * Reference to the simulation engine
     */
    sim: Sim;
    /**
     * Reference to the randomness source for simulation
     */
    randomSIM: Random;
    /**
     * Reference to the randomness source for AI
     */
    randomAI: Random;
    /**
     * Counts all products created in the beginning
     */
    numberOfProducts: number;

    /**
     * Reference to the configuration of the experiment
     */
    config: ExperimentSettings;
    /**
     * Reference to the analytics object. It provides function for documenting experiment results
     */
    analytics: Analytics;
    /**
     * Reference to the production network. It is the entry point of the simulation run. 
     */
    productionNetwork: ProductionNetwork;
    /**
     * Reference to the production system.
     */
    productionSystem: IProductionSystem;
    /**
     * Reference to the orchestrator. The orchestrator handles the interaction between AI and model
     */
    orchestrator: Orchestrator;

    /**
     * Start the simulaton
     */
    run(): Promise<any>;
    /**
     * Pause the simulation
     */
    pause();
    /**
     * Continue simulation, after it was paued
     */
    continue();
    /**
     * stop the simulation; It cannot be continued afterwards. 
     */
    stop();
}