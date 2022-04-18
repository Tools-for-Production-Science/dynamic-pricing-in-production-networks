/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Matthias Henzi, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import Environment from "./Environment";
import { Analytics } from "../../SystemManagement/Analytics/Analytics";
import { Agent } from "./Agent";
import msglog from "../../SystemManagement/MessengingSystem/MsgLog";
import * as tf from '@tensorflow/tfjs-node';
import { Sim, Random } from "simts";
import { ExperimentSettings } from "../../SystemManagement/Configuration/ExperimentSettings";
import Phase from "./Phase";

export default class Orchestrator
{
    /**
     * Agent that chooses action for parameter L
     */
    agentL: Agent;
    /**
     * Agent that chooses action for parameter N
     */
    agentN: Agent;

    /**
     * Configuration for the agents
     */
    config: ExperimentSettings;
    /**
     * simulation object
     */
    sim: Sim;
    /**
     * analytics object  
     */
    analytics: Analytics | undefined = undefined;
    /**
     * variable for storing the last action of the agents
     */
    lastAction: number[] = [0];
    /**
     * variable for storing the last state
     */
    lastState: tf.Tensor | undefined;
    /**
     * controls whaether sampling is possible
     */
    samplingPossible = false;

    /**
     * this string holds the last model of the agents in order to be able to clean the heap after the learning finished
     */
    private historicAgentModel = "";
    /**
     * Information wheather the run is already finsihed
     */
    private finished = false;
    /**
     * Holds the current phase of the orchestrator. 
     */
    currentPhase = Phase.l1;
    /**
     * Counts the number of replays. Is used to decide when to switch from one agent to the other
     */
    replayCounter = 0;

    /**
     * constructor for the orchestrator class
     * @param environment environment of the problem
     * @param configuration ML configuration object
     * @param sim simulation object
     * @param random random object
     * @param memory memory object
     * @param analytics analytics object
     * @param environmentConfiguration environment configuration object
     */
    constructor(environment: Environment, configuration: ExperimentSettings, sim: Sim, random: Random, analytics: Analytics)
    {
        this.sim = sim;
        this.config = configuration;

        //check if environment is ready
        if (!environment.isReady())
            msglog.log(msglog.types.error, "Environment was not ready to be used before given to orchestrator", this, true);

        //initialize the agent
        this.agentL = new Agent(configuration.mlconfigL, environment, analytics, random, this);

        //initialize environment 2 for the agent N
        let env2 = new Environment();
        env2.shallowCopyEnvironment(environment);
        env2.addStateFunction((() =>
        {
            return this.lastAction[1];
        }).bind(this));
        env2.setReady();

        this.agentN = new Agent(configuration.mlconfigN, env2, analytics, random, this);

        //load critic model if specified
        this.loadModelWeightsString(configuration.agentmodel);

        this.analytics = analytics;
    }

    enableProdMode()
    {
        tf.enableProdMode();
    }
    /**
     * This function is called when the simulation is finished in order to relaese the heap memory
     */
    clean()
    {

        this.historicAgentModel = this.buildNNWeightsForSaving(); //save the model for later reuse
        this.saveModelWeights(this.historicAgentModel);
        if (this.lastState != undefined)
            this.lastState.dispose();

        this.agentL.clean();
        this.agentN.clean();
        this.agentL = null!;
        this.agentN = null!;
        tf.disposeVariables();
        this.finished = true;
    }




    /**
     * This function orchestrates a learning in different phases depending on the given sceanrio, e.g. Train AGentL, Train AgentN, then switch between both
     * The different phases are determined based on scenario specific criteria hardcoded in this function
     */
    private updatePhase(): Phase
    {
        switch (this.config.envConfig.scenario)
        {
            case 1: //orchestrate agents based on sceanrio 1
                /**
                 * Training of l, then n, then no training; based on timing via config
                 */
                this.currentPhase = this.phaseScenario1();
                break;
            case 2:
            case 3:
                /**
                 * Training of l, then n, then permanent switching
                 */
                this.currentPhase = this.phaseScenarioDynamic();
                break;
            case 4:
                /**
                 * Training of l, then n, total sim time is equally split after settling phase
                 */
                this.currentPhase = this.phaseScenarioTrainingOnly();
                break;
            case 5:
                /**
                 * Pretrained model, no changing
                 */
                this.currentPhase = Phase.l2;
                return Phase.noT;
                break;
            case 6:
            case 7:
                /**
                 * Pretrained model with permanent switching to update agent
                 */
                this.currentPhase = this.phaseScenarioPermanentSwitching();
                break;
            default:
                throw "No scenario map found or no phase found!"

        }
        return this.currentPhase;
    }
    /**
     * This controls the orchestration (different phases of learning, sampling and actions) of a scenario 1
     * @returns 
     */
    private phaseScenario1(): Phase
    {
        let durationEinschwingphase = this.config.envConfig.lengthSettlingPhase;
        if (this.sim.time() < durationEinschwingphase)
            return Phase.no; //kein Training
        else if ((this.sim.time() < ((this.config.envConfig.totalSimTime) * this.config.envConfig.startOfBenchmarkTest) / 2 + durationEinschwingphase))  //Phase 1 train L
            return Phase.l1; //train L
        else if ((this.sim.time() < this.config.envConfig.totalSimTime * this.config.envConfig.startOfBenchmarkTest + durationEinschwingphase) && this.currentPhase == Phase.l1)
            return Phase.ln; //Übergang l zu n
        else if (this.sim.time() < this.config.envConfig.totalSimTime * this.config.envConfig.startOfBenchmarkTest + durationEinschwingphase && (this.currentPhase == Phase.ln || this.currentPhase == Phase.n))
            return Phase.n; // training n
        else
            return Phase.noT; //kein Training in der Aufzeichnung
        throw "no Phase found"
    }

    private phaseScenarioTrainingOnly(): Phase
    {
        let durationEinschwingphase = this.config.envConfig.lengthSettlingPhase;
        if (this.sim.time() < durationEinschwingphase)
            return Phase.no; //kein Training
        else if (this.sim.time() < (this.config.envConfig.totalSimTime - durationEinschwingphase) / 2 + durationEinschwingphase)  //Phase 1 train L
            return Phase.l1; //train L
        else if ((this.sim.time() < (this.config.envConfig.totalSimTime - durationEinschwingphase) + durationEinschwingphase) && this.currentPhase == Phase.l1)
            return Phase.ln; //Übergang l zu n
        else if ((this.sim.time() < (this.config.envConfig.totalSimTime - durationEinschwingphase) + durationEinschwingphase) && (this.currentPhase == Phase.ln || this.currentPhase == Phase.n))
            return Phase.n; // training n
        else
            return Phase.noT; //kein Training in der Aufzeichnung
        throw "no Phase found"
    }

    private phaseScenarioDynamic(): Phase
    {
        let durationEinschwingphase = this.config.envConfig.lengthSettlingPhase;
        if (this.sim.time() < this.config.envConfig.totalSimTime * this.config.envConfig.startOfBenchmarkTest + durationEinschwingphase)
        {
            return this.phaseScenario1();
        }
        else
        {
            return this.phaseScenarioPermanentSwitching()
        }
        throw "not implemented"
    }
    /**
     * Training of agents during the whole sim time. Switch training from one agent to the other every "switchAgentAfterAmountOfReplays" times of replays (defined in config). If current Phase is l1, l2 is returned to switch to the n-l2-training-cycle
     * @returns The phase to switch to
     */
    private phaseScenarioPermanentSwitching(): Phase
    {
        switch (this.currentPhase)
        {
            case Phase.n:
                if (this.config.mlconfigN.switchAgentAfterAmountOfReplays - this.replayCounter <= 0)
                {
                    this.replayCounter = 0;
                    return Phase.nl;
                }
                return Phase.n;
            case Phase.nl:
                return Phase.l2;
            case Phase.l1:
                return Phase.l2
            case Phase.l2:
                if (this.config.mlconfigL.switchAgentAfterAmountOfReplays - this.replayCounter <= 0)
                {
                    this.replayCounter = 0;
                    return Phase.ln;
                }
                return Phase.l2;
            case Phase.ln:
                return Phase.n;
        }
        throw "not implemented"
        // else if ((this.sim.time() < ((this.config.envConfig.totalSimTime) * this.config.envConfig.startOfBenchmarkTest + durationEinschwingphase) / 2))  //Phase 1 train L
        //     return [1, Phase.l1]; //train L
        // //Teiler basiertes Wechseln
        // else if ((this.sim.time() > this.config.envConfig.totalSimTime * this.config.envConfig.startOfBenchmarkTest + durationEinschwingphase) && this.firstIterationN)
        //     return 4; //Übergang n zu l
    }

    /**
     * function for prediticing one or more actions
     * @param min takes an array with the minimum boundaries of a parameter
     * @param max takes an array of the maximum boundaries of <a parameter
     * @returns returns scaled actions
     */
    getAction(min: number[], max: number[]): number[]
    {
        //if the last state is undefined, it's the first product of a planning period -> therefore calculate it here
        if (this.lastState == undefined)
        {
            this.lastState = this.agentL.environment.getStateTensor();
        }

        let nState: tf.Tensor;
        switch (this.currentPhase)
        {
            case Phase.no:
                //throw "no is not implemented";
                break;
            //Use agent l only - this is specific for l1, as n is not trained yet
            case Phase.l1:
                this.lastAction = [0.8, this.agentL.get_action(this.lastState)[0], -0.8];
                break;
            //Switching from n to l
            case Phase.nl:
                this.currentPhase = Phase.l2;
            case Phase.noT:
            //get action from l and n because n is trained by now
            case Phase.l2:
                this.lastAction[1] = this.agentL.get_action(this.lastState)[0];
                nState = this.agentN.environment.getStateTensor();
                this.lastAction[2] = this.agentN.get_action(nState)[0];
                nState.dispose();
                break;
            //switching from  l to n
            case Phase.ln:
                this.currentPhase = Phase.n;
            case Phase.n:
                this.lastAction[2] = this.agentN.get_action(this.lastState)[0];
                break;
            default:
                throw "not implemented Phase";
        }

        this.samplingPossible = true;

        //scale the actions
        let returnValue: number[] = (this.scaleAction(min, max, this.lastAction));

        return returnValue;
    }

    /**
     * function for calculating the scaled actions for a parameter
     * @param minParameterValue takes an array with the minimum boundaries of a parameter
     * @param maxParameterValue takes an array with the maximum boundaries of a parameter
     * @param actionValue takes the unscaled values
     * @returns returns an array with the scales actions
     */
    scaleAction(minParameterValue: number[], maxParameterValue: number[], actionValue: number[]): number[]
    {
        //create an array for the scales values
        let scaledValue = new Array(actionValue.length);

        for (let i = 0; i < actionValue.length; i++)
        {
            //scale the actions and save them in the array
            scaledValue[i] = minParameterValue[i] + ((actionValue[i] + 1) / 2) * (maxParameterValue[i] - minParameterValue[i]);
            if (scaledValue[i] < minParameterValue[i]) //crrentyl only the minimum is protected
                scaledValue[i] = minParameterValue[i];

            msglog.log(msglog.types.debug, 'scaled action ' + scaledValue[i], this)
        }

        return scaledValue;
    }

    /**
     * Adds a Sample to memory based on last state action pair. Can only be called once after an action was taken before
     */
    addSample(lastReward: number): void
    {
        let rew: number = lastReward;
        let nextstate: tf.Tensor | tf.Tensor[] | undefined;

        //sample can only be added to the memory, if an action was drawn
        if (this.samplingPossible)
        {
            //set sampling to false for the next iteration
            this.samplingPossible = false;
            var memoryLastAction: number[];
            let temp;
            //add the sample to the memory
            switch (this.updatePhase())
            {
                case Phase.no:
                case Phase.noT:
                    break;
                case Phase.nl: //Übergang: Sample muss noch zu n, nextstate schon zu l
                    this.lastAction[1] = this.agentL.get_action(this.agentL.environment.getStateTensor())[0];
                    this.agentN.addSample(this.lastState, this.lastAction, rew, this.agentN.environment.getStateTensor());
                    nextstate = this.agentL.environment.getStateTensor();
                    break;
                case Phase.l1:
                case Phase.l2:
                    nextstate = this.agentL.environment.getStateTensor();
                    this.agentL.addSample(this.lastState, this.lastAction, rew, nextstate);
                    break;
                case Phase.ln://Übergang: Sample muss noch zu l, nextstate schon zu n
                    this.agentL.addSample(this.lastState, this.lastAction, rew, this.agentL.environment.getStateTensor()); //sample noch zu l
                    temp = this.agentL.environment.getStateTensor();
                    this.lastAction[1] = this.agentL.get_action(temp)[0];
                    temp.dispose();
                    nextstate = this.agentN.environment.getStateTensor(); //Sstate für n vorbereiten
                    break;
                case Phase.n:
                    memoryLastAction = this.lastAction.slice();
                    let tempState = this.agentL.environment.getStateTensor();
                    this.lastAction[1] = this.agentL.get_action(tempState)[0];
                    tempState.dispose();
                    nextstate = this.agentN.environment.getStateTensor();
                    this.agentN.addSample(this.lastState, memoryLastAction, rew, nextstate);
                    break;
                case "nl":
                    break;
                default:
                    throw "not implemented phase in replay";

            }
        }
        else
        {
            msglog.log(msglog.types.warning, "Es wurde versucht ein Sample zur Memory hinzuzufügen ohne, dass vorher eine Action gewählt wurde", this);
            return;
        }


        if (nextstate != null && nextstate != undefined)
        {
            //this.lastState?.dispose();
            this.lastState = (nextstate as tf.Tensor).clone();
        }
        else
            this.lastState = undefined;
    }

    /**
     * function for training the agent
     */
    async replay()
    {
        switch (this.currentPhase)
        {
            case Phase.noT:
            case Phase.no:
                break;
            case Phase.l1:
            case Phase.l2:
            case Phase.ln:
                this.sim.MLPause = true;
                await this.agentL.train_model(this.agentL.trainActor, 1);
                this.replayCounter++;
                this.agentL.trainActor = !this.agentL.trainActor; //only relevant for separate training of actor and critic
                this.sim.continueML();
                break;
            case Phase.nl:
            case Phase.n:
                this.sim.MLPause = true;
                await this.agentN.train_model(this.agentN.trainActor, 2);
                this.replayCounter++;
                this.agentN.trainActor = !this.agentN.trainActor;
                this.sim.continueML();
                break;
            default:
                throw "not implemented phase in replay";
        }
    }

    /**
     * function for saving the current agent model
     */
    saveModelWeights(model: string)
    {
        //FS:Der Zugriff auf DBCon über anayltics ist gerade eher eine Hacklösung, weil das eigentlich nicht für reine Speicheroperationen gedacht ist...
        if (this.analytics != undefined)
            if (this.analytics.dbcon != undefined)
            {
                try
                {
                    this.analytics.dbcon.saveAgent(this.analytics.expid, model);
                    msglog.log(msglog.types.debug, 'critic and actor saved', this)
                }
                catch (e)
                {
                    console.log(e);
                }
            }
    }

    private buildNNWeightsForSaving(): string
    {
        let actorL = this.NNWeightsIterator(this.agentL.actor.getWeights());
        let criticL = this.NNWeightsIterator(this.agentL.critic.getWeights());

        let actorN = this.NNWeightsIterator(this.agentN.actor.getWeights());
        let criticN = this.NNWeightsIterator(this.agentN.critic.getWeights());

        let agent = { actorL, criticL, actorN, criticN };

        return JSON.stringify(agent);
    }

    private NNWeightsIterator(layerModel: tf.Tensor[])
    {
        let ar = new Array();
        layerModel.forEach((l) =>
        {
            ar.push(l.arraySync());
        })

        return ar;
    }

    getModelWeightsString()
    {
        if (this.finished)
            return this.historicAgentModel;
        else
            return this.buildNNWeightsForSaving();
    }

    loadModelWeightsString(modelString)
    {
        //load model if specified
        if (modelString)
            if (modelString != "")
            {
                let agent = JSON.parse(modelString);

                this.loadWeightsIntoModel(this.agentL.actor, agent.actorL);
                this.loadWeightsIntoModel(this.agentN.actor, agent.actorN);
                this.loadWeightsIntoModel(this.agentL.critic, agent.criticL);
                this.loadWeightsIntoModel(this.agentN.critic, agent.criticN);
            }
    }


    /**
     * function for loading a saved wights model into a given layer model
     */
    loadWeightsIntoModel(model: tf.LayersModel, weights: JSON)
    {
        let counter = 0;
        try
        {
            let weightsTensor = new Array();
            for (let i = 0; i < model.layers.length; i++)
            {
                //For LeakyRelu
                if (model.layers[i].getWeights().length == 0)
                {
                    continue;
                }
                else
                {
                    weightsTensor = new Array();

                    let a = model.layers[i].getWeights()[0].shape;//weights shape
                    if (a[0] != null && a[1] != null)
                    {
                        weightsTensor.push(tf.tensor(Object.values(weights[counter]) as any));
                        counter++;
                    }
                    tf.dispose(a);
                    if (model.layers[i].getWeights().length == 2) //optional bias
                    {
                        a = model.layers[i].getWeights()[1].shape;//bias shape
                        if (a[0] != null)
                        {
                            weightsTensor.push(tf.tensor1d(Object.values(weights[counter]) as any));
                            counter++;
                        }
                    }
                    tf.dispose(a);
                    model.layers[i].setWeights(weightsTensor);
                }
            }

            this.analytics?.logDebug("Model erfolgreich aus Settings geladen", this, false);
        }
        catch
        {
            this.analytics?.logError("Laden des Models aus Settings gescheitert", this, false);
        }
    }

    /**
     * function for printing the weights of a model
     * @param model takes the model from which we want to print the weights
     */
    printWeights(model: tf.LayersModel): void
    {
        for (let i = 0; i < model.layers.length; i++)
        {
            msglog.log(msglog.types.debug, 'model weights ' + model.layers[i].getWeights(), this)
        }
    }
}