/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/
export class PossMaschinesV2 {
    historic: string[]; 
    recommended: string[]; 
    /**
     * This is a helper class to load machines from a csv input into an array. As of now, historically used machines and recommended machines a distinguished
     */
    constructor() {
        this.historic = new Array<string>();
        this.recommended = new Array<string>();
    }

    loadHistoricFromString(data: string) {
        this.historic = data.split(', ');


        this.historic = this.historic.map(element => {
            element.trim();

            if (element[0] == ' ') element = element.slice(1);
            if (element[element.length - 1] == ' ') element = element.substring(0, element.length - 1); //schneidet den Tab am Ende ab, der Tab muss am Ende entfernt werden, um die Maschine später zu erkennen.


            return element;
        })
    }

    loadRecommendedFromString(data: string) {
        data = this.removeChars(data, new Array('[', ']', '\'', '\''));
        this.recommended = data.split(', ');

        this.recommended = this.recommended.map(element => {
            element.trim();
            if (element[0] == ' ') element = element.slice(1);
            if (element[element.length - 1] == ' ') element = element.substring(0, element.length - 1);
            return element;
        })
    }

    private removeChars(data: string, c: Array<string>) {
        c.forEach(element => {
            data = data.split(element).join('');
        });

        return data;
    }
}