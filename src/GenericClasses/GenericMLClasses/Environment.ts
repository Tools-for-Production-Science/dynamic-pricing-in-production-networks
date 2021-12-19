/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import * as tf from '@tensorflow/tfjs-node';
import msglog from "../../SystemManagement/MessengingSystem/MsgLog";
import IEnvironmentComponent from "../GenericSimulationClasses/Interfaces/IEnvironmentComponent";


export default class Environment
{
    /**
     * This is a handle to all environment components
     */
    private components = new Array<IEnvironmentComponent>();
    /**
     * This is a handle to all state functions returning the current state in the moment of execution
     */
    private stateFunctions = new Array<() => number | number[]>();

    private initialized = false;

    private numTotalStates = 0;

    isDone(): boolean
    {
        return false;
    }

    /**
     * Marks the environment as ready to run. Must be called before given to orchestrator. Gives the signal that no more state functions or reward functions will be added to the component so that the neural network can be designed
     * @param 
     */
    setReady()
    {
        this.initialized = true;
    }

    /**
     * Checks if environment is ready to run
     * @returns true if ready false else
     */
    isReady(): boolean
    {
        if (this.components.length == 0 || this.stateFunctions.length == 0)
            return false;

        return this.initialized
    }

    /**
     * calls all reward functions from all components to aggregate the overall reward
     * @returns the reward of the whole environment in the current state
     */
    computeReward(): number
    {

        let res = 0;
        this.components.forEach((val: IEnvironmentComponent) =>
        {
            res += val.calculateReward.call(val);
        })
        return res;
    }

    /**
     * returns the number of total states. Specifically relevant to design the neccessary neural network
     */
    getStateDimension(): number
    {

        msglog.log(msglog.types.debug, 'state dimension when calling getStateDimension in Environemnt ' + this.numTotalStates, this)

        //this is not working well, because states are allowed to return number arrays not only numbers
        return this.numTotalStates;
    }

    /**
     * function to get a tensor of the state
     * @returns returns the state tensor
     */
    getStateTensor(): tf.Tensor
    {
        let res = new Array<number>();

        this.stateFunctions.forEach((val) =>
        {
            let ret = val();

            if (Array.isArray(ret))

                ret.forEach((ele) =>
                {
                    res.push(ele);
                });
            else
                res.push(ret);
        })

        msglog.log(msglog.types.debug, 'length of res in get state tensor - environment', this)
        msglog.log(msglog.types.debug, res.length, this)

        let stateTensor = tf.tidy(() => tf.tensor(res).reshape([-1, this.getStateDimension()]));

        return stateTensor;

    }

    /**
     * Register an environment component
     * @param component The component to be registered as relevant in the environment; An object needs to implement the 
     * IEnvironmentComponent interface in order to be registered
     */
    registerComponent(component: IEnvironmentComponent)
    {
        let stateFunctions = component.getStateFunctions();
        stateFunctions[0].forEach(element =>
        {
            this.stateFunctions.push(element);
        });
        this.numTotalStates += stateFunctions[1];

        this.components.push(component);
    }

    /**
     * Manually register a state function
     * @param func the function which will return a state as a number. Don't forget to bind the context.
     */
    addStateFunction(func: () => number)
    {
        this.numTotalStates += 1;
        this.stateFunctions.push(func);
    }

    /**
     * Helper function to copy a given environment to another environment
     * @param env the environment as the copy source
     */
    shallowCopyEnvironment(env: Environment)
    {
        this.numTotalStates = env.numTotalStates;
        this.stateFunctions = [...env.stateFunctions];
        this.components = [...env.components];

    }


}