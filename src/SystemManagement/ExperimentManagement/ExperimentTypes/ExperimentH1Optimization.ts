/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import IExperiment from "../IExperiment";
import ExperimentTemplate from "./_ExperimentTemplate";
import * as hpjs from 'hyperparameters';
import { Random } from "simts";
import EngineH1 from "../../../Environment/H1/EngineH1";
import DataStream from "../../Analytics/DataStream";

/**
 * This experiment is a random search based hyperparameter optimisation for the h1 environment. It automatically tries n random configiurations each for x times to find a well performing one. 
 */
export default class ExperimentH1Optimization extends ExperimentTemplate implements IExperiment
{
    async run()
    {
        let repid = this.analytics.createNewReport("Optimierungsfeedback");
        let rewardReport = this.analytics.createVisualisationWriter("Reward über alle Experimente", "line", repid);
        let configRewardReport = this.analytics.createVisualisationWriter("Reward per Experiment", "line", repid);
 
        let processedData: DataStream;
        processedData = this.analytics.createDataStreamWriter("ProcessedData");
        this.analytics.deactivateReportsCreation = true;
        let roundCounter = 0;

        let initialSeed = this.settings.seed;
        let randobj = new Random(initialSeed)
        let revenueTotal = 0;
        let optFunction = async ({ minActorLearningRate, actorLlambda, actorHiddenLayerSize, criticHiddenLayerSize, actorNeuronsPerLayer, criticNeuronsPerLayer, includeSeparateTraining, sigmaGiven, minCriticLearningRate, criticLlambda, epochs }) =>
        {
            if (this.interrupted)
                return { dummy_loss: 0, status: hpjs.STATUS_FAIL };


            let rewardExperiments: Array<number> = new Array<number>();
            let lengthReward: Array<number> = new Array<number>();

            let seeds: number[] = [];

            this.setConfigAgentL(minActorLearningRate, actorLlambda, actorHiddenLayerSize, criticHiddenLayerSize, actorNeuronsPerLayer, criticNeuronsPerLayer, includeSeparateTraining, sigmaGiven, minCriticLearningRate, criticLlambda, epochs)
            this.setConfigAgentN(minActorLearningRate, actorLlambda, actorHiddenLayerSize, criticHiddenLayerSize, actorNeuronsPerLayer, criticNeuronsPerLayer, includeSeparateTraining, sigmaGiven, minCriticLearningRate, criticLlambda, epochs); 

            let customerArray = this.settings.envConfig.customerArray;
            let trafficArray = this.settings.envConfig.trafficArray;
            let numberOfTestsPerConfig = this.settings.mlconfigL.hpjsNumberOfIterationsPerConfig;

            for (let index = 0; index < customerArray.length; index++)
            {
                {
                    this.settings.envConfig.customerAmount = customerArray[index];

                    for (let j = 0; j < trafficArray.length; j++)
                    {
                        this.settings.envConfig.traffic = trafficArray[j];
                        let r = 0;
                        while (r < numberOfTestsPerConfig)
                        {
                            this.settings.seed = Math.round(randobj.random() * 100000000000000); 
                            this.analytics.deactivateDataStreamWriterCreation = true;
                            this.analytics.writeLogsToDB = false;
                            this.analytics.deactivateReportsCreation = true;
                            this.settings.envConfig.scenario = 4; //only learning for total sim time
                            let tempTime = this.settings.envConfig.totalSimTime;
                            this.settings.envConfig.totalSimTime = 1400000;
                            let sim = new EngineH1(this.settings, this.analytics);
                            await sim.run();
                            let trained_model = sim.orchestrator!.getModelWeightsString();

                            for (let s = 0; s < this.settings.envConfig.scenarioList.length; s++) 
                            {
                                //hier getseed von TrueRandom nutzen
                                this.settings.envConfig.totalSimTime = tempTime;
                                this.settings.envConfig.scenario = this.settings.envConfig.scenarioList[s];
                                seeds.push(this.settings.seed as number);

                                let simulation = await this.hpjsRunH1(trained_model);
                                revenueTotal += simulation.productionSystem.revForH1Optimization;
                                if (this.interrupted)
                                    return { dummy_loss: 0, status: hpjs.STATUS_FAIL };

                                let finalExperimentReward = this.dbcon.getRewardFromExperiment(this.expid, simulation.productionNetwork.rawReward.groupid)

                                rewardReport.write(roundCounter + "_" + index + "_" + j + "_" + s + "_" + r, finalExperimentReward[0] / finalExperimentReward[1]);
                                rewardExperiments.push(finalExperimentReward[0]);
                                lengthReward.push(finalExperimentReward[1]);
                            }
                            r++;
                        }
                    }
                }
            }

            roundCounter++;

            let meanReward = 0;
            let length = 0;
            for (let i = 0; i < rewardExperiments.length; i++)
            {
                meanReward += rewardExperiments[i];
                length += lengthReward[i];
            }
            meanReward = meanReward / length;
            configRewardReport.write(roundCounter, meanReward);
            let configurationHJPSRun = JSON.stringify(this.settings);
            this.dbcon.saveConfiguration(this.expid, configurationHJPSRun);

            processedData.write('MeanReward', meanReward);
            processedData.write('ConfigurationHPJS', configurationHJPSRun);
            processedData.write('Seeds', JSON.stringify(seeds));
            processedData.write('Initial Seed', initialSeed);
            seeds = [];
            processedData.write('MeanRevenue', revenueTotal / (customerArray.length + trafficArray.length + numberOfTestsPerConfig + this.settings.envConfig.scenarioList.length));

            return { loss: meanReward, status: hpjs.STATUS_OK };
        }

        let hiddenLayerSpace = new Array<number>()
        let neuronsPerLayer = new Array<number>()
        let epochsArray = new Array<number>()

        //
        for (let i = 1; i <= 3; i++)
        {
            hiddenLayerSpace.push(i);
        }

        //
        for (let i = 1; i <= 15; i = i + 2)
        {
            neuronsPerLayer.push(i);
        }



        for (let i = 1; i <= 5; i += 1)
        {
            epochsArray.push(i);
        }


        const space = {
            minActorLearningRate: hpjs.uniform(0.001, 0.00001),
            actorLlambda: hpjs.uniform(0.001, 0.00001),
            actorHiddenLayerSize: hpjs.choice(hiddenLayerSpace),
            criticHiddenLayerSize: hpjs.choice(hiddenLayerSpace),
            actorNeuronsPerLayer: hpjs.choice(neuronsPerLayer),
            criticNeuronsPerLayer: hpjs.choice(neuronsPerLayer),
            sigmaGiven: hpjs.choice([false]),
            minCriticLearningRate: hpjs.uniform(0.001, 0.00001), 
            criticLlambda: hpjs.uniform(0.001, 0.00001),
            epochsArray: hpjs.choice(epochsArray)
        };

        // finding the optimal hyperparameters using hpjs.fmin. Here, 6 is the # of times the optimization function will be called (this can be changed)
        const trials = await hpjs.fmin(
            optFunction, space, hpjs.search.randomSearch, this.settings.mlconfigL.hpjsNumberOfRandomSearches,
            { rng: new hpjs.RandomState(this.settings.seed) } 
        )

        const opt = trials.argmin;

        console.log('optFunction finished')
        console.log('trials', trials);

        this.reportFinished();
    }


    async hpjsRunH1(trained_model: string)
    {
        this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.writeLogsToDB = false;
        this.analytics.deactivateReportsCreation = true;
        let sim = new EngineH1(this.settings, this.analytics);
        sim.orchestrator?.loadModelWeightsString(trained_model);

        this.analytics.deactivateDataStreamWriterCreation = false;
        this.analytics.deactivateReportsCreation = false;
        let writer = this.analytics.createDataStreamWriter("Raw Reward");
        sim.productionNetwork.rawReward = writer;

        this.dbcon.writeToDBCriterion = (() =>
        {
            return sim.sim.time() > (this.settings.envConfig.totalSimTime * this.settings.envConfig.startOfBenchmarkTest) + this.settings.envConfig.lengthSettlingPhase
        }).bind(this); 
        this.analytics.deactivateDataStreamWriterCreation = true;
        this.analytics.deactivateReportsCreation = true;

        this.engine = sim;

        await sim.run();

        this.analytics.deactivateDataStreamWriterCreation = false;
        this.analytics.deactivateReportsCreation = false;
        this.dbcon.syncDataWithDB();

        return sim;
    }

    setConfigAgentL(minActorLearningRate, actorLlambda, actorHiddenLayerSize, criticHiddenLayerSize, actorNeuronsPerLayer, criticNeuronsPerLayer, includeSeparateTraining, sigmaGiven, minCriticLearningRate, criticLlambda, epochs)
    {

        this.settings.mlconfigL.minActorLearningRate = minActorLearningRate
        this.settings.mlconfigL.maxActorLearningRate = Math.min(minActorLearningRate * 10, 0.1)
        this.settings.mlconfigL.actorLlambda = actorLlambda
        this.settings.mlconfigL.actorHiddenLayerSize = actorHiddenLayerSize
        this.settings.mlconfigL.criticHiddenLayerSize = criticHiddenLayerSize
        this.settings.mlconfigL.actorNeuronsPerLayer = actorNeuronsPerLayer
        this.settings.mlconfigL.criticNeuronsPerLayer = criticNeuronsPerLayer
        this.settings.mlconfigL.sigmaGiven = sigmaGiven
        this.settings.mlconfigL.minCriticLearningRate = minCriticLearningRate
        this.settings.mlconfigL.maxCriticLearningRate = Math.min(minCriticLearningRate * 10, 0.1)
        this.settings.mlconfigL.criticLlambda = criticLlambda
        this.settings.mlconfigL.epochsCritic = epochs
    }



    setConfigAgentN(minActorLearningRate, actorLlambda, actorHiddenLayerSize, criticHiddenLayerSize, actorNeuronsPerLayer, criticNeuronsPerLayer, includeSeparateTraining, sigmaGiven, minCriticLearningRate, criticLlambda, epochs)
    {
        this.settings.mlconfigN.minActorLearningRate = minActorLearningRate
        this.settings.mlconfigN.maxActorLearningRate = Math.min(minActorLearningRate * 10, 0.1)
        this.settings.mlconfigN.actorLlambda = actorLlambda
        this.settings.mlconfigN.actorHiddenLayerSize = actorHiddenLayerSize
        this.settings.mlconfigN.criticHiddenLayerSize = criticHiddenLayerSize
        this.settings.mlconfigN.actorNeuronsPerLayer = actorNeuronsPerLayer
        this.settings.mlconfigN.criticNeuronsPerLayer = criticNeuronsPerLayer
        this.settings.mlconfigN.sigmaGiven = sigmaGiven
        this.settings.mlconfigN.minCriticLearningRate = minCriticLearningRate
        this.settings.mlconfigN.maxCriticLearningRate = Math.min(minCriticLearningRate * 10, 0.1)
        this.settings.mlconfigN.criticLlambda = criticLlambda
        this.settings.mlconfigN.epochsCritic = epochs
    }

}