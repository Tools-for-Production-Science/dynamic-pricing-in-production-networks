/* The following applies to the code modifications
The MIT License (MIT)

Copyright (c) 2021 Florian Stamer

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
*/

import { string } from "mathjs";


/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item)
{
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two or more objects. Conserves field in target and adds or overwrites all other fields with values from sources
 * @param target
 * @param ...sources
 */
let mem = new Array();
export function mergeDeep(target, ...sources)
{
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source))
  {
    for (const key in source)
    {
      mem.push(key);
      if (isObject(source[key]))
      {
        if (!target[key]) 
        {
          console.log("Warning: adding new object field to settings: " + key);
          Object.assign(target, { [key]: {} });
        }
        mergeDeep(target[key], source[key]);
      } else
      {
        if (target[key] === undefined) 
        {
          console.log("Warning: adding new value to settings: " + key);
        }
        Object.assign(target, { [key]: source[key] });
      }
    }
    checkUntouchedKeys(target);
  }

  return mergeDeep(target, ...sources);
}

function checkUntouchedKeys(target)
{
  for (const key in target)
  {
    if (isObject(target[key]))
    {
      checkUntouchedKeys(target[key]);
    }
    else
    {
      if(!mem.includes(key))
      {
        console.log("In default settings was not changed: " + key);
      }
    }
  }
}