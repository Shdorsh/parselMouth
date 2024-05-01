# ParselMouth
## A combinatory parser library

This is my attempt at creating a combinatory parser library that feels easy to use and allows for easy usage. It attempts to maximize DX (Developer exprience) while staying coherent to its style.

**How do I start?**

Simply import the module and call its main function, creating a new parselMouth instance:

```
import parselMouth from "parselMouth";

const pm = parselMouth();
```

You can add parsers through the ```pm.addParser``` method. All parsers are methods of the parselMouth instance, which can be used alone to create more complex parsers or used inside ```pm.addParser``` to finally be parser when you run the parselMouth instance with ```pm.run```. To retrieve results or errors, you can use ```pm.getResults``` and ```pm.getErrors```.

Here an example of some parsers:
 - ```pm.char```: Validates, that the parsed char is the same as the char given as argument.
 - ```pm.string```: Validates, that the parsed string equals the string given as argument.
 - ```pm.digit```: Validates, that the parsed char is a digit.
 - ```pm.letter```: Validates, that the parsed char is a letter. There is also ```pm.upperCaseLetter``` and ```pm.lowerCaseLetter``` for easier use.
 - ```pm.not```: Validates, that the parsed char or string does not valiate the parser given as argument.
 - ```pm.many```: Validates the parsed string with a given parser as many times as it can.
 - ```pm.and```: Validates the current position of the code with each given parser. It does not travel along the code
 - ```pm.chain```: Validates the parsed code with each of the parsers applied one after another, moving on in the parsed code.
 - ```pm.same```: Validates, that the parsed position in the code is the same as the captured results of another given parser.
 - ```pm.ahead```: Validates, that the position in front of the current one fits the given parser.
 - ```pm.back```: Validates, that the position behind the current one fits the given parser.
Many more, feel free to explore!

***With this, you could build something like that:***
```
import parselMouth from "parselMouth";

const pm = parselMouth();

const usedQuote = pm.choice(pm.char("'"), pm.char("\""), pm.char("´"));
const endQuote = pm.same(usedQuote);
const stringInsides = pm.many(pm.not(endQuote));

const parsedString = pm.chain(usedQuote, stringInsides, endQuote);

pm.addParser(parsedString);
pm.run("'Hello world'");

console.log(pm.getResults);
```

Parsers also have their own methods, such as:
 - ```parser.join```: Joins the captured group into an array with a single concatenated string. Returns the parser for chaining.
 - ```parser.map```: Allows you to set a mapping function that will be run on the result of the next parsed code. Returns the parser for chaining.
 - ```parser.error```: Sets the error message of a parser. Returns the parser for chaining.
 - ```parser.getError```: Returns the error from the last parsed code.
 - ```parser.getResult```: Returns the result from the last parsed code.

***Let's revisit our code!***
```
import parselMouth from "parselMouth";

const pm = parselMouth();

const usedQuote = pm.choice(pm.char("'"), pm.char("\""), pm.char("´"));
const endQuote = pm.same(usedQuote).error("Error: Did not find matching quotes at end of string.");
const stringInsides = pm.many(pm.not(endQuote));

const parsedString = pm.chain(usedQuote, stringInsides, endQuote).join();

pm.addParser(parsedString);
pm.run("'Hello world'");

console.log(pm.getResults);
```
