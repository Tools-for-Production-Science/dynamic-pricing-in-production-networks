/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import { expDB } from "../expDB";
import Visualisation from "./Visualisation";

export default class DataStream
{

    private expid: number;
    private _groupid: number;

    public get groupid(): number
    {
        return this._groupid;
    }

    private name: string;
    private dbcon: expDB;

    visualisations = new Array<Visualisation>();

    /**
     * Create a new datastream in the database
     * @param expid id of experiment
     * @param name name of datastream
     * @param dbcon the database connector
     * @param deactivateWriting wheather the writer shall be deactivated
     */
    constructor(expid: number, name: string, dbcon: expDB, deactivateWriting: boolean)
    {
        this.expid = expid
        this.name = name;
        this.dbcon = dbcon;
        this._groupid = dbcon.setupNewRawDataGroup(expid, name);

        if (deactivateWriting)
            this.write = (...params) => { };
    }
    /**
     * This function lets a visualisation subscribe to the datastream to show its data
     * @param vis the visualisation object which subscribes to the datastream
     */
    subscribeVisualisation(vis: Visualisation)
    {
        this.dbcon.subscribeVis(vis.id, this._groupid);
        this.visualisations.push(vis);
    }

    /**
     * Schreibt einen Datensatz auf den Stream
     * @param label Name des Datensatzes (x-Wert)
     * @param data Datenwert (y-Wert)
     * @param direct Soll der Wert direkt geschrieben werden, oder ist puffern okay. Standard ist direkt
     */
    write(label:string|number, data:string|number|boolean|undefined, direct = false)
    {
        let dataStr = ""+data;
        this.dbcon.writeExperimentData((this as any).groupid, this.expid, label, dataStr, direct);
        this.visualisations.forEach(val =>
        {
            val.addData(label, dataStr);
        });

    }

}