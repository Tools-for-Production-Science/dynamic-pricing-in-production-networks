/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import express from 'express';
import fs = require('fs');
import Ddos = require('ddos');
import { mergeDeep } from './HelperFunctions';
import cp = require('child_process');

const jsdom = require("jsdom"); 
const { JSDOM } = jsdom; 
const dom = new JSDOM(); 

import { Experimentator } from './ExperimentManagement/Experimentator';
import { ExperimentSettings } from './Configuration/ExperimentSettings';
import hasher from 'object-hash'

require('source-map-support').install();


/**
 * if the production argument is passed console log will be deactivated
 */
let arg = process.argv[2];
if (arg == "production")
{
    console.log = () => { };
}

let port: number = 3001;
let app = express();
let ddos = new Ddos({ burst: 60, limit: 70, maxexpiry: 10 })
let rawdata;
let config;

/**
 * This is a simple protection against unauthorized access from crawlers. This backend will only react, if the secret token is send in the header. Anyway, everybody having access to the frontend (code) can access the backend.
 */
try
{
    rawdata = fs.readFileSync('config.json', 'utf8');
    config = JSON.parse(rawdata);
}
catch {
    config = { secret: "2bf8928c97088a91cdc65fb6399b54e98c366523920cccd4e90c650dbdc2e14912b283c25fd955571068ee4d5762b1860e14248065e7dba19f28d23700332ebceeb92f2322a603b9ba4ec96be63c7d16bd5b6d8f40215a2f59a7255afa744232d26dec89ad7f2b0b5e883057a2e6d6113a4e969f645debd6956ca2f626ed8fa0f83a9325fc4e3ac61d52d2e7bc165bf0816b7cfe9b9e936053904d971f2ca9c067306751dac9fe465083cc1cd1d6ccfa6c638d69ca371efd800ed9cd415f8c03520dc68bf7e7c402fa5a3c21ef89aa8a1a0e7b2923826eb97fc83358043f607606400629e302b492e5355646266f42104eb4070c881cb4ed144cbbeba7895abb727dcd923d41a5d6a403a2acc6461cdd4764581730a59cc59539972eb6f4ad80cc2f5e58d639abf12d9789381cd9d3f8d8d82c34b9160b8ac263cc5bfdd0e3a2" };
}

/**
 * Currently not used. The version hash and version date is extracted from the git repo so the current version of the server can be checked via the backend
 */
let versionDate = "N/A";
let versionHash = "N/A";
/*
try
{
    versionDate = cp.execSync('git show -s --format=%ci').toString();
    versionHash = cp.execSync('git rev-parse HEAD').toString();
}
catch { }
*/
let server = require('http').createServer(app);
server.timeout = 0;

server.listen(port, function ()
{
    console.log('Webserver läuft und hört auf Port ' + port);
});

/**
 * Middleware for receiving the body content
 * @param req 
 * @param res 
 * @param next 
 */
function rawBody(req, res, next)
{
    req.setEncoding('utf8');
    req.rawBody = '';
    req.on('data', function (chunk)
    {
        req.rawBody += chunk;
    });
    req.on('end', function ()
    {
        next();
    });
}

app.use(ddos.express);

app.use(rawBody); //Own Middleware to get Plaintext from Request
app.use(function (req, res, next)
{
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, secret");
    if (req.method === 'OPTIONS')
    {
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
        return res.status(200).json({});
    }

    if (req.headers.secret == config.secret)
        next();
});


/**
 * Entrypoint for the simulation framework
 */
let exp = new Experimentator(arg=="production");

/**
 * Start a new experiment. The configuration must be in the request body, otherwise the request is rejected. 
 */
app.post('/start', function (req, res)
{
    if (typeof (req as any).rawBody == 'undefined')
    {
        res.writeHead(404);
        res.end();
        return;
    }
    let jsonString: string = (req as any).rawBody;
    let config = JSON.parse(jsonString);
    let expSett = new ExperimentSettings();

    mergeDeep(expSett, config);


    exp.queueExperiment(expSett);
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.write("Simulation started")
    res.end();
    return;
});

/**
 * Stop the experiment with given id.
 */
app.post('/stop', function (req, res)
{
    if (typeof (req as any).rawBody == 'undefined')
    {
        res.writeHead(404);
        res.end();
        return;
    }

    let jsonString: string = (req as any).rawBody;
    let list = JSON.parse(jsonString);

    exp.stop(list);

    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end();
    return;
});

/**
 * Pause the experiment with given id.
 */
app.post('/pause', function (req, res)
{
    defaultReqHandler(req, res, true, false, exp.pause, exp);
    return;
});

/**
 * Continue the experiment with given id.
 */
app.post('/continue', function (req, res)
{
    defaultReqHandler(req, res, true, false, exp.continue, exp);
    return;
});

/**
 * Get a list of all experiments. Will send status code 204 if the list did not change since the last request in order to save bandwidth
 */
app.post('/getExp', async (req, res) =>
{

    if (typeof (req as any).rawBody == 'undefined')
    {
        res.writeHead(404);
        res.end();
        return;
    }

    let jsonString: string = (req as any).rawBody;

    let tabledata = exp.dbcon.getExperiments();
    let hash = hasher(tabledata);
    if (hash == jsonString)
    {
        res.writeHead(204); //no content
        res.end();
    }
    else if (typeof (tabledata) == "object" && tabledata)
    {
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        let response = {};
        response["versionDate"] = versionDate;
        response["versionHash"] = versionHash;
        response["tabledata"] = tabledata;
        res.write(JSON.stringify(response));
        res.end();
    }
    else
    {
        res.writeHead(500);
        res.end();
    }
    return;
});

/**
 * Download the database; currently only the list of experiments is downloaded, not the raw data
 */
app.post('/downloadDB', async (req, res) =>
{
    var filePath = './db/experiments.db';
    var stat = fs.statSync(filePath);
    res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        "Content-Disposition": "attachment; filename=experiments.db"
    });

    var readStream = fs.createReadStream(filePath);
    // We replaced all the event handlers with a simple call to readStream.pipe()
    readStream.pipe(res);
});

/**
 * Download the configuration used for the experiment
 */
app.post('/downloadSettings', async (req, res) =>
{
    defaultReqHandler(req, res, true, true, exp.getConfigurationAndAgent, exp);
});

/**
 * Delete all databases
 */
app.post('/deleteAll', async (req, res) =>
{
    exp.deleteAll();
    res.writeHead(200, {
        'Content-Type': 'text/plain'
    });
    res.end();
    return;
});

/**
 * Delete specific experiment
 */
app.post('/delete', async (req, res) =>
{
    defaultReqHandler(req, res, true, false, exp.removeId, exp);
});

/**
 * Get a list of reports
 */
app.post('/getReports', async (req, res) =>
{
    defaultReqHandler(req, res, true, true, exp.getReports, exp);
});

/**
 * Get a specific report consisting of different charts summarizing an aspect of the experiment
 */
app.post('/getReport', async (req, res) =>
{
    defaultReqHandler(req, res, true, true, exp.getReport, exp);
});

/**
 * Show all raw data csvs laying on the server
 */
app.post('/csvlist', async (req, res) =>
{
    res.writeHead(200, {
        'Content-Type': 'application/json'
    });
    let repsString = "{ERROR}";
    try
    {
        repsString = JSON.stringify(fs.readdirSync('./csv'));
    }
    catch { }

    res.write(repsString);
    res.end();
});

/**
 * Upload a csv to the server
 */
app.post('/uploadCSV', async (req, res) =>
{
    if (typeof (req as any).rawBody == 'undefined')
    {
        res.writeHead(404);
        res.end();
        return;
    }

    let jsonString: string = (req as any).rawBody;
    let jsonObj = JSON.parse(jsonString);
    let name = jsonObj["name"];
    let data = jsonObj["data"];
    try
    {
        fs.writeFileSync("./csv/" + name, data);

        res.writeHead(200, {
            'Content-Type': 'application/json'
        });

        res.write("OK");
        res.end();

    }
    catch
    {
        res.writeHead(404, {
            'Content-Type': 'text/plain'
        });

        res.write("Error: File write failed");
        res.end();
    }

});

/**
 * Provides a standard handling for routes with following (optional) functionality: it can execute a function, return the value of a function
 * @param req Forwarding of request object
 * @param res Forwarding of esponse object
 * @param needsBody Boolean if a request body is needed. Will be given as a parameter to the caller-Function
 * @param answer Boolean if return of caller function should be send back
 * @param caller The caller function to be executed
 * @param context The context in which the function should be executed
 * @returns 
 */
function defaultReqHandler(req, res, needsBody: boolean, answer: boolean, caller: Function, context: object)
{
    let result;
    if (needsBody)
    {
        if (typeof (req as any).rawBody == 'undefined')
        {
            res.writeHead(404);
            res.end();
            return;
        }
        let jsonString: string = (req as any).rawBody;
        let body = JSON.parse(jsonString);

        result = caller.call(context, body) //preserve correct context
    }
    else
        caller();

    if (answer && result)
    {
        let repsString = JSON.stringify(result);
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        res.write(repsString);
    }
    else if (answer && !result)
    {
        res.writeHead(404);
    }
    else
    {
        res.writeHead(200);
    }
    res.end();
    return;
}
/**
 * Provide simple client if necessary (all in one solution);
 */
//app.use(express.static('../simpleclient/dist'));
