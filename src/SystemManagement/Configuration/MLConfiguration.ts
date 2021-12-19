/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { ActivationIdentifier, activationOptions } from '@tensorflow/tfjs-layers/dist/keras_format/activation_config';

export class MLConfiguration
{
    /**
     * the number of actions that we want to predict
     */
    numActions: number = 3;
    /**
     * the discount rate of future rewards
     */
    discountRate: number = 0.95;
    /**
     * learning rate that the actor starts with
     */
    minActorLearningRate: number = 0.001
    /**
     * learning rate that the actor wants to reach
     */
    maxActorLearningRate: number = Math.min(this.minActorLearningRate + 0.0001, 0.1)


    /**
     * learning rate that the critic wants to reach
     */
    minCriticLearningRate: number = 0.01
    /**
     * learning rate that the critic starts with
     */
    maxCriticLearningRate: number = Math.min(this.minCriticLearningRate + 0.0001, 0.1)
    /**
     * update parameter of the learning rate for the actor
     */
    actorLlambda: number = 0.0001;
    /**
     * update parameter of the learning rate for the critic
     */
    criticLlambda: number = 0.0035;

    /**
     * hidden layer size of the actor
     */
    actorHiddenLayerSize: number = 5;                            
    /** 
     * neurons per hidden layer for the actor
     */
    actorNeuronsPerLayer: number = 50;                           

    /**
     * hidden layer size of the actor
     */
    criticHiddenLayerSize: number = 5;                           
    /**
     * neurons per hidden layer for the critic
     */
    criticNeuronsPerLayer: number = 15;                          


    /**
     * decides if we want to train either train critic or actor
     */
    includeSeparateTraining: boolean = true;                    

    /**
     * start value for sigma
     */
    startSigma: number = 0.3;                                    
    /**
     * end value for sigma
     */
    endSigma: number = 0.001;                                    
    /**
     * adaption rate for sigma
     */
    llambdaSigma: number = 0.0005;                               

    /**
     * defines whether to use the model with sigma given or the model that predicts sigma
     */
    sigmaGiven = true;                                          

    /**
     * How many iterations per configuration with random seeds should be run when doing a random search hyperparameter optimization
     */
    hpjsNumberOfIterationsPerConfig = 5;
    /**
     * How many configurations should be run when doing a random search hyperparameter optimization
     */
    hpjsNumberOfRandomSearches = 100;
    
    /**
     * Currently unused. Activaes the customer estimator to map a huge amount of customers to the different customer types
     */
    useCustomerEstimator = false;

    /**
     * Which activation function should be used in the hidden layers of the agents
     */
    activationFunction = 'relu' as ActivationIdentifier | 'leakyRelu';

    /**
     * The lower bound of the weight initialization of the neural networks
     */
    lowerBoundInitialization = -0.2;
    /**
     * The upper bound of the weight initialization of the neural networks
     */
    upperBoundInitialization = 0.2;
    /**
     * How many epochs the critic should be trained. 
     */
    epochsCritic = 3;
    /**
     * Must be an integer. Controls when to switch from agent l to agent n and in reverse as multiples of replays.  
     */
    switchAgentAfterAmountOfReplays = 1; //muss eine ganze Zahl sein!


}

