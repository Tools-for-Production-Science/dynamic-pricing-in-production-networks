[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.5791971.svg)](https://doi.org/10.5281/zenodo.5791971)

# dynamic-pricing-in-production-networks

This code shows a complete implementation of a reinforcement learning agent and simulation environment to simulate a company in a production network setting prices dnamically depending on the individual preference of customers and the current state of the production system (e.g. capacity utilization, shortages, supply)
The general concept is shown in the following figure:

<h1 align="center">
    <a href="https://github.com/Tools-for-Production-Science/dynamic-pricing-in-production-networks" title="Dynamic Pricing">
    <img width=90% alt="" src="https://github.com/Tools-for-Production-Science/dynamic-pricing-in-production-networks/blob/main/concept.jpg"> </a>
    <br>
</h1>

# What is special about this work

- high detail of the model
- individual customers with individual preference in terms of preferred lead time and price
- multiple production assets, e.g. machines
- minimum slack based production control
- Reinforcement learning implemented with Tensorflow.js
- easy deployment with docker and server based architecture makes it easy to distribute the application and run it on multiple server at the same time
    

# How to use it

First of all install all neccessary packages:
```
npm i
```
To compile the code into build, typescript is needed. it is recommended to install typescript compiler globally.
```
npm i -g typescript
```
With typescript, it is recommended to use watch mode
```
tsc -w //Watch mode
```
Alternatively, it is also possible to compile only once (no automatiuc recompile on change)
```
tsc //compile just once
```

Now, there are multiple different ways to run the code. 
### Nodejs
First, the code can be executed directly via nodejs
```
node ./built/SystemManagement/Server.js
```
### Docker
Second, it is possible to use docker.
With the -v volume commands the database and csv files become persistent. Instead of "engineC" you can name the container anyway you want.
```
docker build -t engine . //Instead of "engine" it is possible to name the image anyway you want
docker run -d --name engineC -p 3001:3001 -v /home/experiments:/usr/src/app/db -v /home/csv:/usr/src/app/csv engine
```

### Visual Studio Code
Third, it is possible to use the predefined vscode templates - which is basically the same as running with nodejs but more convenient. In order to do so, open the folder with vs code. In the run tab there are multiple options:
System: Starts the backend and previously compiles the code
System w/o Rebuild: Starts the backend server without a rebuild of code
System w/o Rebuild (Production): Starts the code without compiler and log stream to speed up execution - this mode is recommended for runs where no debugging of code is necessary
System Auto Test: This executes a predefined configuration and checks for any suspicious Abnormalities
System Auto Test (full): This executes a test routine to check if the code is basically running for all environments, scenarios etc. (this may take a lot of time)

## Note on provided data

The implemented use cases are based on two real applications. Therefore, the data for the V2 environment could not be provided at all due to intellectual property rights. The data of the h1 environment have been falsified.

## Note on the simulation engine

The simulation engine used is the <a href="https://www.npmjs.com/package/simts" title="link">simts npm package</a>. It was created within this work but can be used for any discrete event simulation approach. The engine is based on sim.js. For more Information see <a href="https://github.com/Tools-for-Production-Science/simts" title="link">link</a>