/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/


import MsgObj from './MessageObject';
import msgTypes from './MessageTypes';
import { blacklist } from './filter';
import { mgntDB } from '../mgntDB';

/**
 * global static class to handle debug messaging. Should be used instead of console.log. 
 */
export default class MsgLog
{
    private static newMsg = new Array<MsgObj>();
    private static allMsg = new Array<MsgObj>();
    private static memSize = 1000;
    static alwaysShowInConsole = true;
    static types = msgTypes;
    static setReporting = false;

    /**
     * Connection to a currently active analytics object to tunnel debug messages to an experiment. Only possible if parallelprocessing = false
     */
    static analyticsHook: any = undefined;
    /**
     * Connection to the database to log to. 
     */
    static dbConnector: mgntDB | null = null;

    /**
     * Short way to write a debug messahe
     * @param msg payload
     * @param sender class who is sending the message
     * @param showInConsole wheather the message shall be displayed in the console. Default is true
     */
    static logDebug(msg, sender, showInConsole = true)
    {
        MsgLog.log(this.types.debug, msg, sender, false, showInConsole);
    }

    /**
     * Short way to write a warning messahe
     * @param msg payload
     * @param sender class who is sending the message
     * @param showInConsole wheather the message shall be displayed in the console. Default is true
     * @param expID Id of the experiment; optional;
    */
    static logWarning(msg, sender, showInConsole = true, expID = -1)
    {
        MsgLog.log(this.types.warning, msg, sender, false, showInConsole);
    }
    /**
     * Short way to write an error message
     * @param msg payload
     * @param sender class object who is sending the message
     * @param throwError wheather the error should throw; default is false
     * @param showInConsole wheather the message shall be displayed in the console. Default is true
     */
    static logError(msg, sender, throwError = false, showInConsole = true)
    {
        MsgLog.log(this.types.error, msg, sender, throwError = true, showInConsole);
    }
    /**
     * logging messages. For short specialised functions see code logDebug, logWarning and logError
     * @param type the type of the message
     * @param msg payload
     * @param sender class who is sending the message
     * @param throwError wheather the error should throw; default is false
     * @param showInConsole wheather the message shall be displayed in the console. Default is true
     * @returns 
     */
    static log(type, msg, sender, throwError = false, showInConsole = true)
    {

        if (this.analyticsHook != undefined)
        {
            this.analyticsHook(type, msg, sender, throwError, showInConsole)
            return;
        }

        let el = new MsgObj();
        el.type = type;
        el.msg = msg;
        el.sender = sender.constructor.name;
        el.date = this.getCurrDate();
        this.allMsg.push(el);

        let filter = blacklist.some((el) => 
        {
            if (el == sender.constructor.name)
                return true;

            return false;
        });

        if (throwError || type == this.types.error)
            filter = false;

        if (this.allMsg.length >= this.memSize) this.allMsg.shift();

        if ((showInConsole || this.alwaysShowInConsole) && !filter) this.showObjInConsole(el, throwError);

        if (throwError)
        {
            throw new Error(msg);
        }
    }

    /**
     * create a timestamp of the current time
     * @returns the timestamp as string
     */
    private static getCurrDate(): string
    {
        var objToday = new Date(),
            weekday = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
            dayOfWeek = weekday[objToday.getDay()],
            dayOfMonth = today + (objToday.getDate() < 10) ? '0' + objToday.getDate() : objToday.getDate(),
            curMonth = objToday.getMonth() + 1,
            curYear = objToday.getFullYear(),
            curHour = objToday.getHours() < 10 ? "0" + objToday.getHours() : objToday.getHours(),
            curMinute = objToday.getMinutes() < 10 ? "0" + objToday.getMinutes() : objToday.getMinutes(),
            curSeconds = objToday.getSeconds() < 10 ? "0" + objToday.getSeconds() : objToday.getSeconds(),
            curMSecs = objToday.getMilliseconds(),
            curMeridiem = objToday.getHours() > 12 ? "PM" : "AM";
        var today = dayOfMonth + "." + curMonth + "." + curYear + " " + curHour + ":" + curMinute + ":" + curSeconds + "." + curMSecs;

        return today;
    }
    /**
     * Helper to transform the log message into a displayable for console
     * @param obj the message object
     * @param throwError wheater an error shall be thrown
     */
    private static showObjInConsole(obj: MsgObj, throwError: boolean = false)
    {
        let errStack = "";
        if (obj.type == msgTypes.error)
            errStack = "\n (" + ((new Error) as any).stack + ") ";

        let logString = "(" + this.types[obj.type] + ")@" + obj.date + " von " + obj.sender + errStack + ": " + obj.msg;
        console.log(logString);
    }
}