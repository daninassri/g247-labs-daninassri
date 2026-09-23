/*
  Starter file for Session 9 Lab — Part 1 (Guided JS Practice)
  Web Application Programming (G247) · CUNEF Escuela Politécnica Superior

  Week 3 · Session 9 · Practice (AF2) · Pair work

  Do NOT rename the functions and do NOT change their signatures — the
  tests at the bottom of this file call them by name. You only write the
  bodies. This is a shared file: everyone completes the same skeletons.
*/

// ---------------------------------------------------------------------
// WARM-UP 1 — greet
// ---------------------------------------------------------------------

// 1a. Function declaration
function greetDeclaration(name = "friend") {
  return `Hello, ${name}!`;
}

// 1b. Function expression
const greetExpression = function (name = "friend") {
  return `Hello, ${name}!`;
};

// 1c. Arrow function
const greetArrow = (name = "friend") => {
  return `Hello, ${name}!`;
};

// ---------------------------------------------------------------------
// WARM-UP 2 — square
// ---------------------------------------------------------------------

// 2a. Function declaration
function squareDeclaration(n) {
  return n * n;
}

// 2b. Function expression
const squareExpression = function (n) {
  return n * n;
};

// 2c. Arrow function
const squareArrow = (n) => {
  return n * n;
};

// ---------------------------------------------------------------------
// WARM-UP 3 — sumArray
// ---------------------------------------------------------------------

// 3a. Function declaration
function sumArrayDeclaration(numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
}

// 3b. Function expression
const sumArrayExpression = function (numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
};

// 3c. Arrow function
const sumArrayArrow = (numbers) => {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) {
    total += numbers[i];
  }
  return total;
};

// ---------------------------------------------------------------------
// WARM-UP 4 — celsiusToFahrenheit
// ---------------------------------------------------------------------

// 4a. Function declaration
function celsiusToFahrenheitDeclaration(celsius) {
  return (celsius * 9 / 5) + 32;
}

// 4b. Function expression
const celsiusToFahrenheitExpression = function (celsius) {
  return (celsius * 9 / 5) + 32;
};

// 4c. Arrow function
const celsiusToFahrenheitArrow = (celsius) => {
  return (celsius * 9 / 5) + 32;
};

// =====================================================================
// TESTS
// =====================================================================

console.assert(greetDeclaration("Ana") === "Hello, Ana!", "greetDeclaration('Ana')");
console.assert(greetDeclaration() === "Hello, friend!", "greetDeclaration() uses default");
console.assert(greetExpression("Ana") === "Hello, Ana!", "greetExpression('Ana')");
console.assert(greetExpression() === "Hello, friend!", "greetExpression() uses default");
console.assert(greetArrow("Ana") === "Hello, Ana!", "greetArrow('Ana')");
console.assert(greetArrow() === "Hello, friend!", "greetArrow() uses default");

console.assert(squareDeclaration(5) === 25, "squareDeclaration(5)");
console.assert(squareExpression(-3) === 9, "squareExpression(-3)");
console.assert(squareArrow(0) === 0, "squareArrow(0)");

console.assert(sumArrayDeclaration([1, 2, 3, 4]) === 10, "sumArrayDeclaration");
console.assert(sumArrayExpression([]) === 0, "sumArrayExpression([])");
console.assert(sumArrayArrow([5, -2, 7]) === 10, "sumArrayArrow");

console.assert(celsiusToFahrenheitDeclaration(0) === 32, "celsiusToFahrenheitDeclaration(0)");
console.assert(celsiusToFahrenheitExpression(100) === 212, "celsiusToFahrenheitExpression(100)");
console.assert(celsiusToFahrenheitArrow(-40) === -40, "celsiusToFahrenheitArrow(-40)");