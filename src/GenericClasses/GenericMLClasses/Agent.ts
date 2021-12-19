/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Matthias Henzi, Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import * as tf from '@tensorflow/tfjs-node';
import { MLConfiguration } from '../../SystemManagement/Configuration/MLConfiguration';
import Environment from './Environment';

import { Analytics } from '../../SystemManagement/Analytics/Analytics';

import msglog from '../../SystemManagement/MessengingSystem/MsgLog'
import { Random } from "simts";

import { SeedOnlyInitializerArgs } from '@tensorflow/tfjs-layers/dist/initializers';
import DataStream from '../../SystemManagement/Analytics/DataStream';
import { Memory } from './Memory';
import { TensorContainerObject } from '@tensorflow/tfjs-node';

class mySeed implements SeedOnlyInitializerArgs
{
    seed: number;

    constructor(seed: number)
    {
        this.seed = seed;
    }
}

export class Agent
{
    myseed: SeedOnlyInitializerArgs;
    //define the attributes of the class A2C Agent
    actor: tf.LayersModel;                              //Actor of the Actor-Critic-Model
    critic: tf.LayersModel;                             //Critic of the Actor-Critic-Model

    actorHiddenLayerSize: number;                        //hidden layer size of the actor
    actorNeuronsPerLayer: number;                        //neurons of each hidden layer for the actor
    criticHiddenLayerSize: number;                       //hidden layer size of the critic
    criticNeuronsPerLayer: number;                       //neurons of each hidden layer for the critic

    currentSigma: number;

    actor_learningr: number;                            //Learning Rate of the Actor
    critic_learningr: number;                           //Learning Rate of the Critic
   
    maxLearningRateCritic: number;                       //Maximum learning rate of the Critic
    minLearningRateCritic: number;                       //Minimum learning rate of the Critic
    criticLlambda: number;                               //llambda for updating the critic learning rate

    environment: Environment;                          //Environment of the Problem
    configuration: MLConfiguration;                     //Configuration of the program
    policyMuWriter!: Array<DataStream>;                            //mue belonging to one action
    policySigmaWriter!: Array<DataStream>;                            //sigma belonging to one action
    repClbScaled!: Array<DataStream>;
    repClbRandomActionFromNormalDis!: Array<DataStream>;
    actorWeightsWriter!: Array<DataStream>;
    criticWeightsWriter!: Array<DataStream>;

    actorLossWriter!: DataStream;           //actor loss
    advantageWriter!: DataStream;
    criticLossWriter!: DataStream;           //critic loss
    counter: number = 1;
    counter2: number = 1;
    rawLoss!: DataStream;

    private reportMueAndSigmaOverall;
    reportActorAndCriticLoss;

    numActions: number;

    random: Random;

    savedMuesL = new Array(); //for printing to csv
    savedMuesK = new Array(); //for printing to csv

    //create policy optimizer with current actor learning rate
    optimizer_policy: tf.AdamOptimizer;

    memory: Memory;                                     //memory for the state, action, reward observations

    trainActor = true;

    /**
     * This is the A2C core agent.
     * @param configuration configuration for the agent
     * @param environment the environment in which the agent acts
     * @param analytics a reference to the analytics object of the experiment
     * @param random a reference to the randomness source
     */
    constructor(configuration: MLConfiguration, environment: Environment, analytics: Analytics | undefined = undefined, random: Random)
    {
        this.memory = new Memory(random);
        this.random = random;
        this.myseed = new mySeed(this.random.random()) as SeedOnlyInitializerArgs;
        msglog.log(msglog.types.debug, 'KI Seed is ' + this.myseed.seed, this)

        this.environment = environment;                                             //use the defined environment
        this.configuration = configuration;
        this.numActions = configuration.numActions;                                       //use the defined configuration

        this.actor_learningr = this.configuration.maxActorLearningRate;
        this.critic_learningr = this.configuration.maxCriticLearningRate;
        this.maxLearningRateCritic = this.configuration.maxCriticLearningRate;
        this.minLearningRateCritic = this.configuration.minCriticLearningRate;
        this.criticLlambda = this.configuration.criticLlambda;

        this.actorHiddenLayerSize = this.configuration.actorHiddenLayerSize;
        this.criticHiddenLayerSize = this.configuration.criticHiddenLayerSize;
        this.actorNeuronsPerLayer = this.configuration.actorNeuronsPerLayer;
        this.criticNeuronsPerLayer = this.configuration.criticNeuronsPerLayer;

        this.currentSigma = this.configuration.startSigma;

        this.actor = this.build_actor();                                            //create a new actor model      
        this.critic = this.build_critic();                                          //create a new critic model

        //create Data Streams, if analytics is defined
        if (analytics)
            this.createReporting(analytics);

        //create policy optimizer with current actor learning rate
        this.optimizer_policy = tf.train.adam(this.actor_learningr);
    }

    /**
     * This function is very important to free up the tensor memory!!!
     */
    clean()
    {
        tf.dispose(this.actor as unknown as TensorContainerObject);
        tf.dispose(this.critic as unknown as TensorContainerObject);
        tf.dispose(this.optimizer_policy as unknown as TensorContainerObject);
        tf.disposeVariables();
    }

    private createReporting(analytics: Analytics)
    {
        this.policyMuWriter = new Array<DataStream>(this.configuration.numActions);
        this.policySigmaWriter = new Array<DataStream>(this.configuration.numActions);
        this.repClbScaled = new Array<DataStream>(this.configuration.numActions);
        this.repClbRandomActionFromNormalDis = new Array<DataStream>(this.configuration.numActions)
        this.actorWeightsWriter = new Array<DataStream>();
        this.criticWeightsWriter = new Array<DataStream>();
        this.reportMueAndSigmaOverall = new Array<number>(this.configuration.numActions);

        for (let i = 0; i < this.configuration.numActions; i++)
        {
            this.reportMueAndSigmaOverall[i] = analytics.createNewReport("Aktionswahl von Parameter " + i)
            this.policyMuWriter[i] = analytics.createVisualisationWriter("Mü für Parameter " + i, "line", this.reportMueAndSigmaOverall[i]);
            this.policySigmaWriter[i] = analytics.createVisualisationWriter("Sigma für Parameter " + i, "line", this.reportMueAndSigmaOverall[i]);
            this.repClbRandomActionFromNormalDis[i] = analytics.createVisualisationWriter("Zufällige Aktion aus Normalverteilung mit Mü und Sigma für Parameter " + i, "line", this.reportMueAndSigmaOverall[i]);
            this.repClbScaled[i] = analytics.createVisualisationWriter("Skalierter Wert für Parameter " + i, "line", this.reportMueAndSigmaOverall[i]);
        }


        this.reportActorAndCriticLoss = analytics.createNewReport("Actor Loss und Critic Loss")
        this.actorLossWriter = analytics.createVisualisationWriter("Actor Loss", "line", this.reportActorAndCriticLoss);
        this.criticLossWriter = analytics.createVisualisationWriter("Critic Loss", "line", this.reportActorAndCriticLoss);
        this.advantageWriter = analytics.createVisualisationWriter("Advantage", "line", this.reportActorAndCriticLoss);
        this.rawLoss = analytics.createDataStreamWriter("loss");
    }

    /**
     * function for creating the actor in the A2C model
     * @returns returns the created actor model
     */
    private build_actor(): tf.LayersModel
    {
        let model: tf.LayersModel;
        //create input for the actor model
        let input = tf.input({ shape: [this.environment.getStateDimension()] });

        //create hidden layers for the model according to defined number of hidden layers
        let denseLayer: any = input;

        for (let i = 0; i < this.actorHiddenLayerSize; i++)
        {
            if (this.configuration.activationFunction == "leakyRelu")
            {
                denseLayer = tf.layers.dense({ units: this.actorNeuronsPerLayer, kernelInitializer: 'ones' }).apply(denseLayer);
                denseLayer = tf.layers.leakyReLU().apply(denseLayer);
            }
            else
                denseLayer = tf.layers.dense({ units: this.actorNeuronsPerLayer, activation: this.configuration.activationFunction, kernelInitializer: 'ones' }).apply(denseLayer);
        }

        let outputlayer: Array<tf.SymbolicTensor> = new Array<tf.SymbolicTensor>();

        if (this.configuration.sigmaGiven)
        {
            //only mue
            for (let i = 0; i < this.configuration.numActions; i++)
            {
                outputlayer.push(tf.layers.dense({ units: 1, name: 'mue_out' + i, activation: 'tanh', kernelInitializer: 'ones', trainable: false }).apply(denseLayer) as tf.SymbolicTensor);
            }

        } else
        {
            //we need numActions müs and sigmas
            //create output mue and sigma
            let mue: Array<tf.SymbolicTensor> = new Array<tf.SymbolicTensor>(this.configuration.numActions);
            let sigma: Array<tf.SymbolicTensor> = new Array<tf.SymbolicTensor>(this.configuration.numActions);

            for (let i = 0; i < this.configuration.numActions; i++)
            {
                mue[i] = tf.layers.dense({ units: 1, name: 'mue_out' + i, activation: 'tanh', useBias: false, kernelInitializer: 'ones', trainable: false }).apply(denseLayer) as tf.SymbolicTensor;
                sigma[i] = tf.layers.dense({ units: 1, name: 'sigma_out' + i, activation: 'sigmoid', useBias: false, kernelInitializer: 'ones', trainable: false }).apply(denseLayer) as tf.SymbolicTensor;
                outputlayer.push(mue[i]);
                outputlayer.push(sigma[i]);
            }
        }

        //create the model with inputs and outputs
        model = tf.model({ inputs: input, outputs: outputlayer });

        //summarize the created model
        model.summary();

        msglog.log(msglog.types.debug, 'actor created', this)
        this.initializeWeights(model)

        return model;
    }

    /**
     * function for creating the critic in the A2C model
     * @returns returns the created critic model
     */
    private build_critic(): tf.LayersModel
    {
        //Layers-Critic
        //create input for the actor model
        let input = tf.input({ shape: [this.environment.getStateDimension()] });

        //create hidden layers for the model according to defined number of hidden layers
        let denseLayer: any = input;

        //create hidden layers for the model according to defined number of hidden layers
        for (let i = 0; i < this.criticHiddenLayerSize; i++)
        {
            if (this.configuration.activationFunction == "leakyRelu")
            {
                denseLayer = tf.layers.dense({ units: this.criticNeuronsPerLayer, kernelInitializer: 'ones' }).apply(i == 0 ? input : denseLayer);
                denseLayer = tf.layers.leakyReLU().apply(denseLayer);
            }
            else
                denseLayer = tf.layers.dense({ units: this.criticNeuronsPerLayer, activation: this.configuration.activationFunction, kernelInitializer: 'ones' }).apply(i == 0 ? input : denseLayer);
        }

        //create output mue with activaten
        let nn_out: tf.SymbolicTensor = tf.layers.dense({ units: 1, activation: 'tanh', kernelInitializer: 'ones', useBias: false }).apply(denseLayer) as tf.SymbolicTensor;

        //create the model with inputs and outputs
        let model = tf.model({ inputs: input, outputs: nn_out });

        //compile the model, as model.fit() will be used
        model.compile({
            optimizer: tf.train.adam(this.critic_learningr),
            loss: 'meanSquaredError',
            metrics: ['mse', 'accuracy']
        })

        //summarize the defined model
        model.summary()

        msglog.log(msglog.types.debug, 'critic created', this)

        this.initializeWeights(model)

        //return the model
        return model;
    }


    /**
     * function for predicting an action based on a given state
     * @param stateTensor takes a state as tf.Tensor
     * @returns returns one or more predicted actions
     */
    get_action(stateTensor: tf.Tensor): number[]
    {
        msglog.log(msglog.types.debug, 'get action started', this)

        //let stateTensor: tf.Tensor | tf.Tensor[] = this.environment.getStateTensor(); 

        msglog.log(msglog.types.debug, 'state tensor for action', this)
        msglog.log(msglog.types.debug, stateTensor, this)

        //use model with given sigma or predicted sigma
        let policy: tf.Tensor | tf.Tensor[] = tf.tidy(() =>
            this.actor.predict(stateTensor)
        );

        msglog.log(msglog.types.debug, 'prediction successfull', this)
        msglog.log(msglog.types.debug, policy, this)

        let policyArrayMue: Array<number> = new Array<number>(this.configuration.numActions);
        let policyArraySigma: Array<number> = new Array<number>(this.configuration.numActions);

        if (this.configuration.sigmaGiven)
        {
            if (this.configuration.numActions == 1)
            {
                policyArrayMue[0] = (policy as tf.Tensor).arraySync()[0][0];
                policyArraySigma[0] = this.currentSigma;
            } else
            {
                for (let i = 0; i < this.configuration.numActions; i++)
                {
                    policyArrayMue[i] = (policy[i] as tf.Tensor).arraySync()[0][0];
                    policyArraySigma[i] = this.currentSigma;
                }
            }
        } else if (!this.configuration.sigmaGiven)
        {
            let j = 0;
            for (let i = 0; i < this.configuration.numActions; i++)
            {
                policyArrayMue[i] = (policy[j] as tf.Tensor).arraySync()[0][0];
                policyArraySigma[i] = (policy[j + 1] as tf.Tensor).arraySync()[0][0];
                j = j + 2;
            }
        }

        msglog.log(msglog.types.debug, 'predict action output', this)
        msglog.log(msglog.types.debug, policyArrayMue, this)
        msglog.log(msglog.types.debug, policyArraySigma, this)

        for (let i = 0; i < this.configuration.numActions; i++)
        {
            this.policyMuWriter[i].write(this.counter, policyArrayMue[i]);
            this.policySigmaWriter[i].write(this.counter, policyArraySigma[i]);
        }

        let act_output: Array<tf.Tensor> = new Array<tf.Tensor>(this.configuration.numActions);

        for (let i = 0; i < this.configuration.numActions; i++)
        {
            act_output[i] = tf.randomNormal([1, 1], policyArrayMue[i], policyArraySigma[i], "float32", this.random.random())
            msglog.log(msglog.types.debug, 'result of this.random.random() is ' + this.random.random(), this)         
        }

        //tidy the used tensors
        tf.tidy(() => stateTensor)

        //increase counter by 1
        this.counter++;

        let ki_action = new Array(this.configuration.numActions)
        for (let i = 0; i < act_output.length; i++)
        {
            ki_action[i] = act_output[i].arraySync()[0][0]
        }

        msglog.log(msglog.types.debug, 'action', this)
        msglog.log(msglog.types.debug, ki_action, this)

        for (let i = 0; i < this.configuration.numActions; i++)
        {
            this.repClbRandomActionFromNormalDis[i].write(this.counter, ki_action[i]);
        }

        if (this.counter < 200)
        {
            this.savedMuesL.push(ki_action[0])
            this.savedMuesK.push(ki_action[1])
        }

        tf.dispose(policy);
        tf.dispose(act_output);
        //return actions;
        return ki_action;
    }

    private getEssentialValuesForActorTraining(batch: Array<any>, i): Array<any>
    {
        let memorySample: Array<any> = batch[i];
        let value: tf.Tensor;
        let nextValue: tf.Tensor;
        let advantage: tf.Tensor;
        let reward: tf.Tensor;
        let actionsArray: tf.Tensor[] = new Array(this.configuration.numActions)

        for (let j = 0; j < this.configuration.numActions; j++)
        {
            actionsArray[j] = (tf.tensor(memorySample[1][j], [1, 1]))
        }
        msglog.log(msglog.types.debug, 'Actions tensor array ' + actionsArray, this)

        reward = tf.tensor(memorySample[2], [1, 1]);
        msglog.log(msglog.types.debug, 'reward: ' + reward, this);

        value = tf.tidy(() => (this.critic.predict(memorySample[0]) as tf.Tensor).reshape([1, 1]));
        msglog.log(msglog.types.debug, 'value ' + value, this)

        if (memorySample[3] == null)
        {
            nextValue = tf.tensor(0, [1, 1])
        } else
        {
            nextValue = tf.tidy(() => (this.critic.predict(memorySample[3]) as tf.Tensor).reshape([1, 1]));
        }

        msglog.log(msglog.types.debug, 'next value', this)
        msglog.log(msglog.types.debug, nextValue, this)

        if (memorySample[3] == null)
        {
            advantage = tf.tidy(() => tf.sub(reward, value).reshape([1, 1]));
        } else
        {
            //advantage = tf.add(reward, tf.sub(tf.mul(this.discount_tensor, nextValue), value)).reshape([1, 1]);
            //da florian bei critic auch nicht die prognose aus vt+1 nimmt, darf das beim advanatge auch nicht berücksichtigt werden
            advantage = tf.tidy(() => tf.sub(reward, value).reshape([1, 1]));

        }
        //advantage = reward;

        msglog.log(msglog.types.debug, 'advantage', this)
        msglog.log(msglog.types.debug, advantage, this)

        nextValue.dispose();
        reward.dispose();
        value.dispose();
        return [
            advantage,
            actionsArray
        ];
    }

    /**
     * function for training the A2C model
     * @param state takes a state as input
     * @param action takes the chosen action as input
     * @param reward takes the reward for the state action pair as input
     * @param nextState takes the next state as input
     */
    async train_model(trainCritic, actionPos)
    {
        if (this.memory.samples.length > 0)
        {
            msglog.log(msglog.types.debug, 'train model started', this);

            let batch = this.memory.sample(-1);
            batch = this.normalizeReward(batch);
            for (let index = 0; index < batch.length; index++)
            {
                batch[index][1] = [batch[index][1][actionPos]];
            }
            //batch: state, action, reward, nextstate
            if (this.configuration.includeSeparateTraining == true)
            {
                if (trainCritic)
                {
                    await this.trainTheActor(batch);
                } else
                {
                    await this.trainTheCritic(batch);
                }
            }
            else
            {
                await this.trainTheActor(batch);
                await this.trainTheCritic(batch);
            }

            //update sigma
            if (this.configuration.sigmaGiven)
            {
                this.currentSigma = this.updateWithExpoSmoothing(this.configuration.startSigma, this.configuration.endSigma, this.configuration.llambdaSigma, this.counter2)
            }

            //clear memory after training           
            this.memory.samples.forEach(s =>
            {
                (s[0] as tf.Tensor).dispose();
                (s[3] as tf.Tensor).dispose();
            })
            this.memory.samples.length = 0;
        }

    }

    maxReward = 0;
    private normalizeReward(batch: Array<any>)
    {
        let abs = 0;
        batch.forEach((e) =>
        {
            abs = Math.abs(e[2])
            if (this.maxReward < abs)
                this.maxReward = abs;
        });
        //Scale Reward down.
        batch.forEach((e, index) =>
        {
            batch[index][2] = e[2] / this.maxReward;
        });

        return batch;
    }

    private async trainTheActor(batch: Array<any>)
    {
        let advantage: tf.Tensor;
        let actionsArray: tf.Tensor[];
        (this.optimizer_policy as any).learningRate = this.actor_learningr;
        for (let i = 0; i < batch.length; i++)
        {

            [advantage,
                actionsArray] = this.getEssentialValuesForActorTraining(batch, i);
            //if condition for differentiating between separate  and non-separate trainingF
            //batch: state, action, reward, nextstate
            //train actor by minimizing loss
            //Last State, advantage, actionsarray             
            let temp = await this.optimizer_policy.minimize(() => this.computePolicyLoss(batch[i][0], advantage, actionsArray), true);
            temp?.dispose(); //this frees the heap, otherwise a memory leak occurs


            tf.dispose(advantage);
            tf.dispose(actionsArray);

            this.actor_learningr = this.updateWithExpoSmoothing(this.configuration.maxActorLearningRate, this.configuration.minActorLearningRate, this.configuration.actorLlambda, this.counter2);
            this.counter2++;
        } //for loop ends 
        msglog.log(msglog.types.debug, 'actor trained', this)
    }

    private async trainTheCritic(batch: Array<any>)
    {
        const { inputs, labels } = tf.tidy(() =>
        {
            //this.computeValueLoss(batch[i][0], target);
            // Step 2. Convert data to Tensor            
            const inputs = batch.map(d => d[0].arraySync()[0]);
            const labels = batch.map(d => d[2]);

            const inputTensor = tf.tensor2d(inputs);
            const labelTensor = tf.tensor1d(labels);

            return {
                inputs: inputTensor,
                labels: labelTensor,
            }
        });

        (this.critic.optimizer as any).learningRate = this.critic_learningr;

        await this.critic.fit(inputs, labels, {
            epochs: this.configuration.epochsCritic,
            batchSize: batch.length,
            verbose: 0,
            callbacks: {
                onEpochEnd: async (epoch, logs) =>
                {
                    if (logs)
                    {
                        this.criticLossWriter.write(this.counter2, logs.mse);
                        this.actorLossWriter.write(this.counter2, 0);
                        let c = 0;
                    }

                    this.counter2++;
                }
            }
        })

        tf.dispose(inputs);
        tf.dispose(labels);
        msglog.log(msglog.types.debug, 'critic trained', this)
        this.critic_learningr = this.updateWithExpoSmoothing(this.configuration.maxCriticLearningRate, this.configuration.minCriticLearningRate, this.configuration.criticLlambda, this.counter2);
    }


    /**
     * function for computing the policy loss
     * @param stateTensor state from observation, given as tensor
     * @param advantage calculated advantage from taking the action in the state
     * @param action action that was taken in the state
     * @returns returns a tf.scalar objekt for minimizing the model
     */
    private computePolicyLoss(stateTensor: tf.Tensor, advantage: tf.Tensor, actionsArray: tf.Tensor[])
    {
        //shapes have to be checked everywhere
        msglog.log(msglog.types.debug, 'computing policy loss of actor', this)
        return tf.tidy(() =>
        {
            //predict actions
            let prediction = this.actor.predict(stateTensor)
            msglog.log(msglog.types.debug, 'prediction is ' + prediction, this)

            //array for mue and sigma of each action
            let mueArray = new Array(this.numActions)
            let sigmaArray = new Array(this.numActions)

            //save the predicted mues and sigmas in a specific array
            if (this.configuration.sigmaGiven)
            {
                if (this.configuration.numActions == 1)
                {
                    mueArray[0] = (prediction as tf.Tensor).reshape([1, 1]);
                    sigmaArray[0] = tf.tensor(this.currentSigma, [1, 1]).reshape([1, 1]);
                } else
                {
                    for (let i = 0; i < this.configuration.numActions; i = i + 1)
                    {
                        mueArray[i] = (prediction as tf.Tensor)[i].reshape([1, 1]);
                        sigmaArray[i] = tf.tensor(this.currentSigma, [1, 1]).reshape([1, 1]);
                    }
                }
                msglog.log(msglog.types.debug, 'mue array is ' + mueArray, this)
            } else if (!this.configuration.sigmaGiven)
            {
                let j = 0;
                for (let i = 0; i < this.configuration.numActions; i++)
                {
                    mueArray[i] = (prediction[j] as tf.Tensor).reshape([1, 1]);
                    sigmaArray[i] = tf.add(prediction[j + 1].reshape([1, 1]), tf.tensor(0.00000000001, [1, 1]))
                    j = j + 2
                }
                msglog.log(msglog.types.debug, 'mue array is ' + mueArray, this)
                msglog.log(msglog.types.debug, 'sigma array is ' + sigmaArray, this)
            }

            //probabilities for several actions
            let probabilityArray: tf.Tensor[] = new Array(this.configuration.numActions);
            let logProbSA: tf.Tensor[] = new Array(this.configuration.numActions);
            let multiplication1SA: tf.Tensor[] = new Array(this.configuration.numActions);
            let multiplication2SA: tf.Tensor[] = new Array(this.configuration.numActions);
            let policyLossSA: tf.Tensor = tf.tensor([1]);

            //calculate the probability of each action
            for (let i = 0; i < probabilityArray.length; i++)
            {
                //check dimension!
                probabilityArray[i] = tf.add(this.probabilityDensityFunction(actionsArray[i], mueArray[i], sigmaArray[i]), tf.tensor(0.000001, [1, 1]));
                //take the natural logarithm of each action
                logProbSA[i] = tf.log(probabilityArray[i]);
                //multiply the logProbSA with -1
                //check shape of -1 tensor
                multiplication1SA[i] = tf.mul(logProbSA[i], tf.tensor(-1))
                //multiply the mulltiplication1SA with the advantage of the actions together
                multiplication2SA[i] = tf.mul(multiplication1SA[i], advantage)
                //convert to a scalar
                //check if we need tf.mean() here            
            }

            msglog.log(msglog.types.debug, 'probabilities computed ' + probabilityArray, this)
            msglog.log(msglog.types.debug, 'logProb computed ' + logProbSA, this)
            msglog.log(msglog.types.debug, 'calculations done', this)

            policyLossSA = multiplication2SA[0].reshape([1]);
            msglog.log(msglog.types.debug, 'multiplication2SA' + multiplication2SA, this)
            msglog.log(msglog.types.debug, 'multiplication2SA' + multiplication2SA[0].reshape([1]), this)
            for (let i = 1; i < this.configuration.numActions; i++)
            {
                policyLossSA = policyLossSA.concat(multiplication2SA[i].reshape([1]));
            }

            msglog.log(msglog.types.debug, 'policy loss several actions' + policyLossSA, this)
            msglog.log(msglog.types.debug, 'tf.mean of policy loss' + tf.mean(policyLossSA), this)


            //write policy loss into report
            let loss = tf.mean(policyLossSA).asScalar();
            this.actorLossWriter.write(this.counter2, loss.arraySync());
            this.criticLossWriter.write(this.counter2, 0);
            this.rawLoss.write("ActorLoss", loss.arraySync());
            this.advantageWriter.write(this.counter2, advantage.arraySync()[0][0]);

            tf.dispose([logProbSA, mueArray, multiplication1SA, multiplication2SA, policyLossSA, prediction, probabilityArray, sigmaArray]);
            return loss;
        })
        //return loss;
    }

    /**
     * function for computing the probability of taking a specific action given the normal distribution with mue and sigma
     * @param action takes the action as tf.Tensor for which a probability is computed
     * @param mue takes a mean as tf.Tensor for specifying the normal distribution 
     * @param sigma takes a sigma as tf.Tensor for specifying the normal distribution
     * @returns returns the probability as tf.Tensor
     */
    private probabilityDensityFunction(action: tf.Tensor, mue: tf.Tensor, sigma: tf.Tensor): tf.Tensor
    {
        //let probability: tf.Tensor = tf.mul(tf.div(tf.exp(tf.mul(tf.square(tf.div(tf.sub(action, mue), sigma)), tf.tensor(-0.5, [1, 1]))), tf.mul(tf.sqrt(tf.tensor(2 * Math.PI, [1, 1])), sigma)), tf.tensor(0.5, [1,1]));

        //((action minus mü) divided by sigma) and all of it squared
        let exponentialPart1 = tf.square(tf.div(tf.sub(action, mue), sigma))

        //multiply result with -0.5
        let exponentialPart2 = tf.mul(exponentialPart1, tf.tensor(-0.5, [1, 1]))

        //use result for e function
        let e_function_result = tf.exp(exponentialPart2)

        //calculate the first part: (take root of 2 time pi), multiply with sigma
        let firsPart = tf.sqrt(tf.tensor(2 * Math.PI, [1, 1]))
        let resultFirstPart = tf.mul(firsPart, sigma)

        //combine both parts
        let resultDensity = tf.div(e_function_result, resultFirstPart);

        //multiply everything with a range -> dicsuss with FS how we handle this
        //let finalProb = tf.mul(resultDensity, tf.tensor(0.2, [1, 1]))

        msglog.log(msglog.types.debug, 'probability density value', this)
        msglog.log(msglog.types.debug, resultDensity, this)

        //return the probability
        return resultDensity;
    }

    /**
      * function for updating the a value using exponential smooting
      * @param endVal takes start value of the smoothing curve
      * @param startVal takes the end value of the smoothing curve
      * @param llambda takes the factor llambda that controls the step size for an update
      * @param steps takes the steps (how many steps have been done so far)
      */
    private updateWithExpoSmoothing(startVal: number, endVal: number, llambda: number, steps: number): number
    {
        return endVal + (startVal - endVal) * Math.exp(-llambda * steps);
    }

    /**
     * function for initializing the weights of an actor model
     * @param model takes the actor model that should be initialized
     */
    private initializeWeights(model: tf.LayersModel): void
    {
        let lowerBoundForSampling = this.configuration.lowerBoundInitialization;
        let upperBoundForSampling = this.configuration.upperBoundInitialization;
        let weights: tf.Tensor[];

        for (let i = 0; i < model.layers.length; i++)
        {
            //For LeakyRelu
            if (model.layers[i].getWeights().length == 0)
                continue;
            else
            {
                weights = new Array();

                let a = model.layers[i].getWeights()[0].shape;//weights shape
                if (a[0] != null && a[1] != null)
                    weights.push(tf.randomUniform([a[0], a[1]], lowerBoundForSampling, upperBoundForSampling, 'float32', this.random.random()));

                if (model.layers[i].getWeights().length == 2) //optional bias
                {
                    a = model.layers[i].getWeights()[1].shape;//bias shape
                    if (a[0] != null)
                        weights.push(tf.zeros([a[0]]));
                }
                model.layers[i].setWeights(weights);
            }
        }
    }

    addSample(lastState: undefined | tf.Tensor, lastAction: number[], rew: number, nextstate)
    {
        this.memory.addSample([lastState, lastAction, rew, nextstate]);
        msglog.log(msglog.types.debug, 'memory ' + this.memory.samples, this)
    }
}