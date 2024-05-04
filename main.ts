/**
 * PARSELMOUTH
 * A parser combinator library for JavaScript because I hated ArcSecond's syntax and felt like I could do better
 * Now watch me fail
 */

/**
 * Main form of all the return values of a parsing function
 * @param success
 * @param capture
 * @param error
 * @param start
 * @param end
 */
interface IParserResult {
  /**
   * Whether the parsing did manage to capture something
   */
  success: boolean;

  /**
   * What string was caught during parsing
   */
  capture: Maybe<TCapture>;

  /**
   * Whether the failure to match something constitutes an error (i.e. "false" for choice)
   */
  error: boolean;

  /**
   * The position where the matching started
   */
  start: number;

  /**
   * The position where the matching ended
   */
  end: number;

  /**
   * The string put out by the parser result
   */
  message?: string;
}

interface IParsingError {
  start: number;
  end: number;
  line: number;
  message: string;
}

interface IPrecheckResult {
  error: boolean;
  message: string
}

type Maybe<T> = null | T;
type TCapture = (string | TCapture)[];
type TParserFunction = (code: string, currentPosition: number) => IParserResult;
type TPrecheckFunction = (code: string, positiong: number) => IPrecheckResult;

// Set up some quick helpers for the most common cases
const positionExceedsLength: TPrecheckFunction = (
  code: string,
  position: number
) => {
  const exceedsEnd = position > code.length;
  return {
    error: exceedsEnd,
    message: `Error: Code length (${code.length}) exceeded currently checked position (${position})`
  };
};

/**
 * Counts the occurence of \n rather quickly
 * @param code The code that is run
 * @param start The starting char from which to count
 * @param end The ending char which to count to
 * @param initial The amount of lines already read
 * @returns
 */
const calculateNumberOfLines = (
  code: string,
  start: number,
  end: number,
  initial = 0
) => {
  for (const letter of code.substring(start, end).split("")) {
    if (letter === "\n") initial += 1;
  }
  return initial;
};

/**
 * Instantiates a new parser result object
 * @returns IParserResult
 */
const createNewParserResult = (position?: number, endPosition?: number, message?: string): IParserResult => ({
  error: false,
  success: false,
  start: position ?? 0,
  end: endPosition ?? position ?? 0,
  capture: null,
  message
});

/**
 * Fuses two captures together, handling all the type differences
 * @param capture
 * @param appendedCapture
 * @returns TCapture
 */
const addToCapture = (
  capture: Maybe<TCapture>,
  appendedCapture: Maybe<TCapture>
): TCapture => {
  if (!appendedCapture || appendedCapture.length === 0) {
    appendedCapture = [];
  }

  if (!capture || capture.length === 0) {
    return appendedCapture;
  }

  capture.push(...appendedCapture);
  return capture;
};

/**
 * Recursively flattens a capture into a single string
 * @param capture the capture to flatten
 * @returns string
 */
const flattenCapture = (capture: TCapture): string => {
  if (!capture) return "";
  const flattenedCapture: TCapture = [];

  for (const captured of capture) {
    flattenedCapture.push(
      typeof captured === "string" ? captured : flattenCapture(captured)
    );
  }

  return flattenedCapture.join("");
};

// Some small combinators that are already preset
const isAtStart: TParserFunction = (code, position) => {
  const isAtStart = position === 0;
  return {
    success: isAtStart,
    capture: null,
    error: !isAtStart,
    start: position,
    end: position + 1,
  };
};
const isAtEnd: TParserFunction = (code, position) => {
  const isAtStart = position === code.length;
  return {
    success: isAtStart,
    capture: null,
    error: !isAtStart,
    start: position,
    end: position,
  };
};

const isCharALowerCaseLetter: TParserFunction = (code, position) => {
  const charCode = code.charCodeAt(position);
  const success = charCode >= 97 && charCode <= 122;
  return {
    success,
    capture: success ? [code[position]] : null,
    error: !success,
    start: position,
    end: position + 1,
  };
};

const isCharAnUpperCaseLetter: TParserFunction = (code, position) => {
  const charCode = code.charCodeAt(position);
  const success = charCode >= 65 && charCode <= 90;
  return {
    success,
    capture: success ? [code[position]] : null,
    error: !success,
    start: position,
    end: position + 1,
  };
};

const isCharALetter: TParserFunction = (code, position) => {
  const charCode = code.charCodeAt(position);
  const success =
    (charCode >= 97 && charCode <= 122) || (charCode >= 65 && charCode <= 90);
  return {
    success,
    capture: success ? [code[position]] : null,
    error: !success,
    start: position,
    end: position + 1,
  };
};

const isCharADigit: TParserFunction = (code, position) => {
  const charCode = code.charCodeAt(position);
  const success = charCode >= 48 && charCode <= 57;
  return {
    success,
    capture: success ? [code[position]] : null,
    error: !success,
    start: position,
    end: position + 1,
  };
};

const captureAnyChar =
  (amountOfChars = 1): TParserFunction =>
  (code, position) => {
    const endPosition = position + amountOfChars;
    const result = createNewParserResult(position, endPosition);
    if (endPosition >= code.length) {
      result.error = true;
      result.end = code.length;
      return result;
    }

    result.success = true;
    result.capture = [code.substring(position, endPosition)];
    result.end = endPosition;
    return result;
  };

const isCharASpecificCharacter =
  (character: string): TParserFunction =>
  (code, position) => {
    const letter = code[position];
    const success = letter === character;
    return {
      success,
      capture: success ? [code[position]] : null,
      error: !success,
      start: position,
      end: position + 1,
    };
  };

const isStringASpecificString =
  (searchedString: string): TParserFunction =>
  (code, position) => {
    const checkedString = code.substring(
      position,
      position + searchedString.length
    );
    const success = searchedString === checkedString;
    return {
      success,
      capture: success ? checkedString.split("") : null,
      error: !success,
      start: position,
      end: position + searchedString.length,
    };
  };

const doesCharFitOneOfThese =
  (parsers: Parser[]): TParserFunction =>
  (code, position) => {
    let results = createNewParserResult();

    let validCapture: Maybe<TCapture> = null;

    for (let parser of parsers) {
      results = parser.run(code, position);
      if (results.error) {
        continue;
      }

      if (results.success) {
        validCapture = results.capture;
        break;
      }
    }

    return {
      ...results,
      capture: validCapture,
    };
  };

const chainMultipleParsers =
  (parsers: Parser[]): TParserFunction =>
  (code, position) => {
    const start = position;
    const capture: TCapture = [];
    let error = false;

    for (let parser of parsers) {
      const intermediateResult = parser.run(code, position);

      if (intermediateResult.error) {
        error = true;
        break;
      }

      if (intermediateResult.capture) {
        capture.push(intermediateResult.capture);
      }

      position = intermediateResult.end;
    }

    return {
      error,
      success: capture ? true : false,
      capture,
      start,
      end: position,
    };
  };

const charFitsMultiple =
  (parsers: Parser[]): TParserFunction =>
  (code, position) => {
    let result = createNewParserResult();
    let validResult: Maybe<TCapture> = null;

    for (const parser of parsers) {
      result = parser.run(code, position);
      if (result.error) {
        break;
      }
      // Ignore lookahead/lookbehind null values and only take what matters
      if (result.capture) {
        validResult = result.capture;
      }
    }

    result.capture = result.error ? null : validResult;
    return result;
  };

const charCanFitRepeatedly =
  (parser: Parser): TParserFunction =>
  (code, position) => {
    const result = createNewParserResult();
    result.start = position;
    result.end = position;

    let intermediateResult = createNewParserResult();
    while (!intermediateResult.error && result.end < code.length) {
      intermediateResult = parser.run(code, result.end);
      if (intermediateResult.capture) {
        result.success = true;
        result.end = intermediateResult.end;
        result.capture = addToCapture(
          result.capture,
          intermediateResult.capture
        );
      }
    }

    return result;
  };

const charOptionallyFitsOne =
  (parser: Parser): TParserFunction =>
  (code, position) => {
    let result = parser.run(code, position);

    return {
      ...result,
      error: false,
    };
  };

const doesntFitParser =
  (parser: Parser): TParserFunction =>
  (code, position) => {
    let result = parser.run(code, position);

    result.success = !result.success;
    result.error = !result.error;

    if (result.success) {
      result.capture = [code.substring(result.start, result.end)];
    } else {
      result.capture = null;
    }

    return result;
  };

const lookAtOffset =
  (offset: number) =>
  (parser: Parser): TParserFunction =>
  (code, position) => {
    const lookedPosition = position + offset;

    const result = parser.run(code, lookedPosition);
    return {
      ...result,
      capture: null,
      start: position,
      end: position,
    };
  };

const checkIfNextCharFits = lookAtOffset(1);
const checkIfPreviousCharFits = lookAtOffset(-1);

const sameAsCapturedResult =
  (parser: Parser): TParserFunction =>
  (code, position) => {
    let capture = parser.getResults()?.capture;

    if (!capture) {
      throw new Error(
        "Error parsing sameAsCapturedResult: found no parsed results from dependency"
      );
    }

    return isStringASpecificString(flattenCapture(capture))(code, position);
  };

class Parser {
  private parsingFunction: TParserFunction;
  private errorMessage: string = "Error parsing";
  private results: IParserResult | null = null;
  private mappingFunction?: ((captureGroup: TCapture) => TCapture);
  private precheckFunction?: TPrecheckFunction;
  private joinResult = false;

  constructor(parsingFunction: TParserFunction, precheckFunction?: TPrecheckFunction) {
    this.parsingFunction = parsingFunction;
    this.precheckFunction = precheckFunction;
  }

  /**
   * Runs the code through the parser on the given position
   * @param code
   * @param position
   * @returns IParserResult
   */
  run = (code: string, position: number): IParserResult => {
    if(this.precheckFunction) {
      const precheck = this.precheckFunction(code, position);
      if (precheck.error) {
        return {
          start: position,
          end: position,
          error: true,
          success: false,
          capture: null,
          message: precheck.message
        }
      }
    }
    this.results = this.parsingFunction(code, position);
    if (this.results.capture) {
      if (this.joinResult) {
        this.results.capture = [flattenCapture(this.results.capture)];
      }
      if (this.mappingFunction) {
        this.results.capture = this.mappingFunction(this.results.capture);
      }
    }

    return this.results;
  };

  /**
   * Change the error message of the parser which is stored when it fails at parsing
   * @param msg
   * @returns this
   */
  error = (msg: string): Parser => {
    this.errorMessage = msg;
    return this;
  };

  /**
   * Map the captured results of the parser, allowing to change what you find
   * @param mappingFunction
   * @returns this
   */
  map = (mappingFunction: (captureGroup: TCapture) => TCapture): Parser => {
    this.mappingFunction = mappingFunction;
    return this;
  };

  /**
   * Makes the captured results of the parser join into a single string after capturing
   * @returns this
   */
  join = () => {
    this.joinResult = true;
    return this;
  };

  /**
   * Makes the captured results of the parser be kept separate, which is the default. Opposite of Parser.join()
   * @returns this
   */
  split = () => {
    this.joinResult = false;
    return this;
  };

  getError = () => this.errorMessage;

  getResults = (): IParserResult | null => this.results;

  getPreCheckFunction = (): TPrecheckFunction|undefined => this.precheckFunction;
}

/**
 * The main combinator builder class
 */
class parselMouth {
  private errors: IParsingError[] = [];
  private parsingResult: IParserResult = createNewParserResult();
  private parserList: Parser[] = [];

  /**
   * Validates that the currently checked character is a letter
   * @returns Parser
   */
  letter = () => new Parser(isCharALetter, positionExceedsLength);

  /**
   * Validates that the currently checked character is specifically an uppercase letter
   * @returns Parser
   */
  upperCaseLetter = () => new Parser(isCharAnUpperCaseLetter, positionExceedsLength);

  /**
   * Validates that the currently checked character is specifically a lowercase letter
   * @returns Parser
   */
  lowerCaseLetter = () => new Parser(isCharALowerCaseLetter, positionExceedsLength);

  /**
   * Validates that the currently checked character is a digit
   * @returns Parser
   */
  digit = () => new Parser(isCharADigit, positionExceedsLength);

  /**
   * Validates that the currently checked character is the certain given character
   * @param char The character to check against. Needs to be 1 character long
   * @returns Parser
   */
  char = (char: string) => {
    if (char.length > 1) {
      throw new Error(
        `parselMouth.char() error: Accepting only a single character, received: ${char}`
      );
    }
    return new Parser(isCharASpecificCharacter(char), positionExceedsLength);
  };

  /**
   * Validates any string of a given size. By default one.
   * @returns Parser
   */
  any = (amountOfChars: number = 1) =>
    new Parser(captureAnyChar(amountOfChars), positionExceedsLength);

  /**
   * Validates the end of a line for the given code. Can be very useful when combined with ahead (i.e. ahead(newline()))
   * @returns Parser
   */
  newline = () => new Parser(isCharASpecificCharacter("\n"), positionExceedsLength);

  /**
   * Validates that the entire next sequence is the same as the given string
   * @param str The string to check against
   * @returns Parser
   */
  string = (str: string) => new Parser(isStringASpecificString(str), positionExceedsLength);

  /**
   * Validates whether the current code fits one of the given parsers
   * @param parsers Parsers being checked against
   * @returns Parser
   */
  choice = (...parsers: Parser[]) => new Parser(doesCharFitOneOfThese(parsers));

  /**
   * Chains multiple parsers one after another. Their validation will occur sequentially, so the order of the arguments is important.
   * @param parsers Parsers being checked against one after another
   * @returns Parser
   */
  chain = (...parsers: Parser[]) => new Parser(chainMultipleParsers(parsers));

  /**
   * Checks that all the given parsers validate the input at the same position
   * @param parsers Parsers that are checked at the same time
   */
  and = (...parsers: Parser[]) => new Parser(charFitsMultiple(parsers));

  /**
   * Validates whether the current code checks the parser multiple times, with a minimum of once
   * @param parser The parser that is checked for many times
   * @returns Parser
   */
  many = (parser: Parser) => new Parser(charCanFitRepeatedly(parser));

  /**
   * Validates the current code non-strictly, i.e.: the parser can be matched or not, the parsing success is optional
   * @param parser The parser that is checked for optionally
   * @returns Parser
   */
  maybe = (parser: Parser) => new Parser(charOptionallyFitsOne(parser));

  /**
   * Validates the current code by inverting the parser's conditions
   * @param parser The parser who should be inverted
   * @returns Parser
   */
  not = (parser: Parser) => new Parser(doesntFitParser(parser), positionExceedsLength);

  /**
   * Validates whether the string at the position in the code is the same as the result of a given parser
   * @param parser
   * @returns
   */
  same = (parser: Parser) => new Parser(sameAsCapturedResult(parser));

  /**
   * Validates the code at the position in front of the current character with the given parser
   * @param parser
   * @returns Parser
   */
  ahead = (parser: Parser) => new Parser(checkIfNextCharFits(parser));

  /**
   * Validates the code at the position before current character with the given parser
   * @param parser
   * @returns Parser
   */
  behind = (parser: Parser) => new Parser(checkIfPreviousCharFits(parser));

  /**
   * Looks whether the parser is at the start of the code
   * @returns Parser
   */
  atStart = () => new Parser(isAtStart, positionExceedsLength);

  /**
   * Looks whether the parser has reached the end of the code
   * @returns Parser
   */
  atEnd = () => new Parser(isAtEnd);

  /**
   * Create a custom parser, using the two arguments code (entrypoint for the parsed code) and position (currently read position) to return a parsed result ({error, success, start, end, capture})
   * @param customFn
   * @returns Parser
   */
  custom = (customParsingFn: TParserFunction, customPrecheckFn: TPrecheckFunction) =>
    new Parser(customParsingFn, customPrecheckFn);

  /**
   * This adds the parsers created with the other methods into the list of parsers that will be executed on run(). This is mandatory so that the parsers are used and allows for more control
   * @param parser The parsers that will be added to the list of parsers executed on run
   */
  addParser = (...parser: Parser[]) => {
    this.parserList.push(...parser);
  };

  /**
   * Runs the parser on the given code. The results can be received from getResults()
   */
  run = (code: string): IParserResult => {
    this.errors.length = 0;

    let lastErroredLine = 1;
    let lastErroredPosition = 0;

    const endResult: IParserResult = createNewParserResult();

    for (const parser of this.parserList) {
      const intermediateResult = parser.run(code, endResult.end);

      // If there are errors, get the new line and position that is erroring out
      if (intermediateResult.error) {
        // Get the line from where the parsing errored
        const error: IParsingError = {
          start: intermediateResult.start,
          end: intermediateResult.end,
          line: lastErroredLine,
          message: intermediateResult.message ?? parser.getError()
        }

        error.line = calculateNumberOfLines(
          code,
          lastErroredPosition,
          intermediateResult.end,
          lastErroredLine
        );
        lastErroredPosition = intermediateResult.end;
        this.errors.push(error);
        
        endResult.success = false;
        endResult.error = true;
        endResult.message = intermediateResult.message;

      } else if (intermediateResult.success) {
        endResult.capture = addToCapture(
          endResult.capture,
          intermediateResult.capture
        );
      }

      endResult.end = intermediateResult.end + 1;
    }

    this.parsingResult = endResult;
    if (endResult.capture && !endResult.error) {
      endResult.success = true;
    }
    return endResult;
  };

  /**
   * Returns the results of the last parsing
   * @returns IParserResults[]
   */
  getResults = () => this.parsingResult;

  /**
   * Returns the errors of the last parsing, with mapped errors
   * @returns IParsingError[]
   */
  getErrors = () => this.errors;

  getParser = () => this.parserList;
}

export default () => new parselMouth();
