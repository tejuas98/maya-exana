/*
 * Maya-Exana — safeEval: a dependency-free arithmetic expression evaluator.
 *
 * Why this file exists (and why it's separate):
 *   Blueprint Studio lets teachers type answer formulas like "speed * time"
 *   or "sqrt(a^2 + b^2)". Running user-supplied strings through eval() or
 *   new Function() is a code-injection vulnerability. Instead this implements
 *   the classic Shunting-Yard algorithm (Dijkstra): tokenize -> Reverse Polish
 *   Notation -> evaluate. It supports ONLY a fixed, safe whitelist:
 *     - binary operators:  + - * / % ^
 *     - unary minus/plus:  -x, +x   (e.g. "-speed", "3 * -2")
 *     - parentheses
 *     - functions:         sqrt, abs, sin, cos, tan, log, ln, exp,
 *                          round, floor, ceil, min, max, pow
 *                          (min/max/pow accept a variable number of args)
 *     - constants:         pi, e
 *     - numbers incl. scientific notation:  1.5, .5, 1.5e-3, 6.022e23
 *     - declared variables
 *   Anything else (unknown identifiers, stray symbols, injected code) is rejected.
 *   A correct argument count is enforced for every function call.
 *
 * Runs identically in Node (module.exports) and the browser (window.AegisEval).
 */

// Functions and how many arguments each accepts. `var` = variadic (>= min).
const FUNCS = {
  sqrt: { fn: Math.sqrt, args: [1, 1] },
  abs: { fn: Math.abs, args: [1, 1] },
  sin: { fn: Math.sin, args: [1, 1] },
  cos: { fn: Math.cos, args: [1, 1] },
  tan: { fn: Math.tan, args: [1, 1] },
  log: { fn: Math.log10, args: [1, 1] },
  ln: { fn: Math.log, args: [1, 1] },
  exp: { fn: Math.exp, args: [1, 1] },
  round: { fn: Math.round, args: [1, 1] },
  floor: { fn: Math.floor, args: [1, 1] },
  ceil: { fn: Math.ceil, args: [1, 1] },
  min: { fn: Math.min, args: [2, Infinity] },
  max: { fn: Math.max, args: [2, Infinity] },
  pow: { fn: Math.pow, args: [2, 2] },
};
const CONSTS = { pi: Math.PI, e: Math.E };

function isOp(t) { return ['+', '-', '*', '/', '%', '^', 'u-', 'u+'].includes(t); }
const PREC = { 'u-': 5, 'u+': 5, '^': 4, '*': 3, '/': 3, '%': 3, '+': 2, '-': 2 };
const RIGHT = { '^': true, 'u-': true, 'u+': true };

function tokenize(expr) {
  // number (with optional scientific notation) | identifier | operator/paren/comma
  const re = /\s*((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|[+\-*/%^(),])/g;
  const tokens = [];
  let m, last = 0;
  while ((m = re.exec(expr)) !== null) {
    if (m.index !== last && expr.slice(last, m.index).trim() !== '') {
      throw new Error(`Unexpected character near "${expr.slice(last)}"`);
    }
    tokens.push(m[1]);
    last = re.lastIndex;
  }
  if (expr.slice(last).trim() !== '') throw new Error(`Unexpected character near "${expr.slice(last)}"`);
  return tokens;
}

function safeEval(expr, vars = {}) {
  const tokens = tokenize(String(expr));
  if (!tokens.length) throw new Error('Empty expression');

  const output = [];     // value stack (RPN evaluated on the fly via applyTop)
  const stack = [];      // operators / functions / parens
  const argCount = [];    // running argument count for the current function call
  let prevType = null;   // 'num' | 'op' | 'lparen' | 'func' | 'comma' | null

  for (const t of tokens) {
    if (/^(?:\d|\.)/.test(t)) {
      output.push(parseFloat(t));
      prevType = 'num';
    } else if (/^[A-Za-z_]/.test(t)) {
      if (t in FUNCS) {
        stack.push({ fn: t });
        prevType = 'func';
      } else if (t in CONSTS) {
        output.push(CONSTS[t]);
        prevType = 'num';
      } else if (t in vars) {
        const v = vars[t];
        if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Variable "${t}" is not a number`);
        output.push(v);
        prevType = 'num';
      } else {
        throw new Error(`Unknown identifier: ${t}`);
      }
    } else if (t === ',') {
      while (stack.length && stack[stack.length - 1] !== '(') applyTop(output, stack.pop());
      if (!stack.length) throw new Error('Misplaced comma (not inside a function call)');
      if (argCount.length) argCount[argCount.length - 1]++;
      prevType = 'comma';
    } else if (t === '+' || t === '-') {
      const unary = prevType === null || prevType === 'op' || prevType === 'lparen' || prevType === 'comma';
      pushOp(output, stack, unary ? (t === '-' ? 'u-' : 'u+') : t);
      prevType = 'op';
    } else if (isOp(t)) {
      pushOp(output, stack, t);
      prevType = 'op';
    } else if (t === '(') {
      // If this '(' opens a function call, start counting its arguments.
      if (stack.length && typeof stack[stack.length - 1] === 'object' && stack[stack.length - 1].fn) {
        argCount.push(1);
      }
      stack.push('(');
      prevType = 'lparen';
    } else if (t === ')') {
      // Empty call like "max()" -> first token after '(' is ')'
      const emptyCall = prevType === 'lparen';
      while (stack.length && stack[stack.length - 1] !== '(') applyTop(output, stack.pop());
      if (!stack.length) throw new Error('Mismatched parentheses');
      stack.pop(); // remove '('
      if (stack.length && typeof stack[stack.length - 1] === 'object' && stack[stack.length - 1].fn) {
        const n = emptyCall ? 0 : (argCount.pop() || 1);
        applyTop(output, stack.pop(), n);
      }
      prevType = 'num';
    } else {
      throw new Error(`Unexpected token: ${t}`);
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top === '(') throw new Error('Mismatched parentheses');
    applyTop(output, top);
  }
  if (output.length !== 1) throw new Error('Invalid expression');
  const result = output[0];
  if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number');
  }
  return result;
}

function pushOp(output, stack, op) {
  while (
    stack.length &&
    isOp(stack[stack.length - 1]) &&
    (PREC[stack[stack.length - 1]] > PREC[op] ||
      (PREC[stack[stack.length - 1]] === PREC[op] && !RIGHT[op]))
  ) {
    applyTop(output, stack.pop());
  }
  stack.push(op);
}

// `argc` is supplied only when applying a function token.
function applyTop(output, token, argc) {
  if (typeof token === 'object' && token.fn) {
    const spec = FUNCS[token.fn];
    const n = argc == null ? 1 : argc;
    const [minA, maxA] = spec.args;
    if (n < minA || n > maxA) {
      const want = maxA === Infinity ? `${minA}+` : (minA === maxA ? `${minA}` : `${minA}-${maxA}`);
      throw new Error(`${token.fn}() expects ${want} argument(s), got ${n}`);
    }
    if (output.length < n) throw new Error(`Not enough operands for ${token.fn}()`);
    const argsArr = output.splice(output.length - n, n);
    output.push(spec.fn(...argsArr));
    return;
  }
  if (token === 'u-') { output.push(-output.pop()); return; }
  if (token === 'u+') { return; }
  if (output.length < 2) throw new Error(`Not enough operands for "${token}"`);
  const b = output.pop();
  const a = output.pop();
  switch (token) {
    case '+': output.push(a + b); break;
    case '-': output.push(a - b); break;
    case '*': output.push(a * b); break;
    case '/': output.push(a / b); break;
    case '%': output.push(a % b); break;
    case '^': output.push(a ** b); break;
    default: throw new Error(`Unknown operator: ${token}`);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { safeEval, FUNCS, CONSTS };
if (typeof window !== 'undefined') window.AegisEval = { safeEval, FUNCS, CONSTS };
