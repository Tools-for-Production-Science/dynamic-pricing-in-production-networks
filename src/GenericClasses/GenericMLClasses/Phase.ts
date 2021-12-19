/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

/**
 * Enum to control different phases of learning and acting of the AI agent
 */
enum Phase
{
   /**
    * nothing happens
    */
   no = "no",
   /**
    * This is the entry phase with Agent L
    */
   l1 = "l1",
   /**
    * transition from l to n
    */
   ln = "ln",
   /**
   * using agent n
   */
   n = "n",
   /**
   * transition from n to L
   */
   nl = "nl",
   /**
   * using agent L in shift mode (could be unneccassary)
   */
   l2 = "l2",
   /* using agent L in shift mode (could be unneccassary)
   */
   noT = "noT"
}

export default Phase;