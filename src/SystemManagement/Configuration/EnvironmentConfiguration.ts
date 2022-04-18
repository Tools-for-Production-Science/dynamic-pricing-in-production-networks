/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/



import { Environment } from "./EnvironmentEnum";

/**
 * The purpose of this class is to provide basic configurations in order to control the simulation
 * All properties are (should be) static
 */
export class EnvironmentConfiguration
{
  //General Config
  /**the environment to use */
  environment = Environment.h1;
  /**the startdate. Only neccessary if reulst shall be translated into dates */
  startDate = "01.01.2021";
  /**the total sim time. If set to -1 the simulation will run forever */
  totalSimTime = 1 * 24 * 60 - 1;
  /**Maximum amount of discrete events to simulate. -1 means unlimted events*/
  maxEvents = -1; //Maximale Anzahl Events die ausgeführt werden. Negative Zahlen heißt unendlich
  //Config for Market
  /**The amount of customers that should be simulated. Will be drawn from preconfigured customer pool specific to the environment*/
  customerAmount: number = 8;
  /** Wheather the AI should be used for negotiating with the customer */
  useAI = false;
  /** After how many interactions the AI shall be trained based on the gained experience */
  replayAfterAmount = 10;
  /** This variable sets the number of days if the negotiation works via the static price negiator*/
  staticLeadTime = 3.0; //in days
  /**This variable sets the fixed surcharge relative to base price for the static negotiator */
  staticPriceRelativeSurcharge = 0.5;
  /**wheather the lead time for the static negotiator should be dynamic meaning every requested lead time from customer will be accepted*/
  dynamicLeadTime = false;

  /**cost for inventory relative to base price */
  inventoryHoldingCost = 0.00041;
  /**delay cost relative to base price */
  delayPenaltyCost = 0.25;
  /**maximum delay penalyt. 2 means 200% of base price meaning the order will not only be for free but the manufacturer has to buy the full price on top*/
  maximumDelayPenalty = 2.0;
  /**For customer preference drift: the minimum value for the a parameter */
  minimumParameterA = 0.1;
  /**For customer preference drift: the maximum value for the a parameter */
  maximumParameterA = 1.0;
  /**For customer preference drift: the minimum value for the b parameter */
  minimumParameterB = 1;
  /**For customer preference drift: the maximum value for the b parameter */
  maximumParameterB = 20;
  /**For customer preference drift: the minimum value for the d parameter */
  minimumParameterD_ = 0;
  /**For customer preference drift: the maximum value for the d parameter */
  maximumParameterD_ = 0.5;
  /**For customer preference drift: the minimum value for the v parameter */
  minimumParameterV = 0;
  /**For customer preference drift: the maximum value for the v parameter */
  maximumParameterV = 1.0;

  //Price function
  /**For scaling the AI action: the minimum value for the L parameter in days*/
  minimumParameterL = 1;                                        //Für das Scaling der Action von Parameter L 0 bis 1 auf 1 bis 40 Tage - Achtung FS: Aktion liegt nicht zwischen 0 und 1 
  /**For scaling the AI action: the maximum value for the L parameter in days*/
  maximumParameterL = 20;                                       //Für das Scaling der Action von Parameter L 0 bis 1 auf 1 bis 40 Tage - Achtung FS: Aktion liegt nicht zwischen 0 und 1 
  /**For scaling the AI action: the minimum value for the K parameter (no unit)*/
  minimumParameterK = 0.1;
  /**For scaling the AI action: the maximum value for the K parameter (no unit)*/
  maximumParameterK = 1.0;
  /**For scaling the AI action: the minimum value for the M parameter (no unit)*/
  minimumParameterM = 0;
  /**For scaling the AI action: the maximum value for the M parameter (no unit)*/
  maximumParameterM = 1;
  /**For scaling the AI action: the minimum value for the n parameter (relative price surcharge; 0 means 0%, 1 means 100%)*/
  minimumParameterN_ = 0;
  /**For scaling the AI action: the maximum value for the n parameter (relative price surcharge; 0 means 0%, 1 means 100%)*/
  maximumParameterN_ = 1.5;

  /**how much traffic is generated next to the picked productgroup*/
  traffic = 1; //
  /**When the data in a simulation run should be considered for validation*/
  startOfBenchmarkTest = 0.5;
  /**Amount of replications. Relevant for e.g. statistic significance*/
  numberOfReplications = 10;

  //reward parameters for AI
  /**for the AI reward function*/
  tardinessPenalty = 0.05;
  /**for the AI reward function*/
  earlinessPenalty = 0.001;
  /**for the AI reward function*/
  nullOrderPenalty = 5;
  /**for the AI reward function*/
  maximumPenalty = 100;

  amountOfYearsForUnusedMachineKPI = 1.0;
  finalRewardPerUnusedMachine = 10;
  /**The scenario controls the customer behavior, e.g. scenario 1: static customers, scenario 2: shortterm customers, scenario 3: price sensitive customers and with this also the behavior of ai (e.g. when to learn which model etc)*/
  scenario = 1; //
  /**See {@link EnvironmentConfiguration#scenario} this list can be used to cover multiple scenarios in one run*/
  scenarioList = [1, 2];
  /**how much the b parameter should be changed per day */
  bDriftReductionInDays = 2.0;
  /**how much the d parameter should be changed per day */
  dDriftReduction = 0.1;
  /**how much the v parameter should be changed per day */
  vDriftReduction = 0.2;
  /**average number of orders per year V2 case 43.000*/
  reductionBase = 43000;
  /**@see EnvironmentConfiguration 
   * For multiple runs this array can control how many customers in a specific run shall be simulated
   * */
  customerArray = [8];
  /**{@link EnvironmentConfiguration#traffic} 
   * For multiple runs this array can control how much traffic in a specific run shall be simulated*/
  trafficArray = [0.75];

  /**how long the settling phase should run; Neccessary for AI to start in a settled environment*/
  lengthSettlingPhase = 150000;
}

let e = new EnvironmentConfiguration()
e.customerArray