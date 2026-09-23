// exercises.js — Laboratorio 3, Parte 2
// SaborCasero — Programación de Aplicaciones Web (G247)

// ---------------------------------------------------------------------
// FizzBuzz
// ---------------------------------------------------------------------
function fizzBuzz(n) {
  for (let i = 1; i <= n; i++) {
    if (i % 3 === 0 && i % 5 === 0) {
      console.log("FizzBuzz");
    } else if (i % 3 === 0) {
      console.log("Fizz");
    } else if (i % 5 === 0) {
      console.log("Buzz");
    } else {
      console.log(i);
    }
  }
}

// ---------------------------------------------------------------------
// findMax — sin usar Math.max
// ---------------------------------------------------------------------
function findMax(numbers) {
  if (numbers.length === 0) {
    return undefined;
  }
  let max = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] > max) {
      max = numbers[i];
    }
  }
  return max;
}

// ---------------------------------------------------------------------
// isPalindrome — ignora mayúsculas, espacios y puntuación
// (refactorizada como arrow function, como pide el enunciado)
// ---------------------------------------------------------------------
const isPalindrome = (str) => {
  const normalized = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const reversed = normalized.split("").reverse().join("");
  return normalized === reversed;
};

// ---------------------------------------------------------------------
// Pruebas — FizzBuzz y los ejercicios anteriores
// ---------------------------------------------------------------------
fizzBuzz(15);

console.assert(findMax([3, 7, 2, 9, 1]) === 9, "findMax basic");
console.assert(findMax([-5, -2, -9]) === -2, "findMax negatives");
console.assert(findMax([]) === undefined, "findMax empty");

console.assert(isPalindrome("racecar") === true, "isPalindrome basic");
console.assert(isPalindrome("A man, a plan, a canal: Panama") === true, "isPalindrome punctuation");
console.assert(isPalindrome("hello") === false, "isPalindrome false case");

// ---------------------------------------------------------------------
// Validación del formulario de acceso (funciones puras, sin DOM)
// ---------------------------------------------------------------------

// Validación básica de forma del email
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Al menos 8 caracteres, una letra y un dígito
function validatePassword(password) {
  const longEnough = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  return longEnough && hasLetter && hasDigit;
}

// Devuelve { valid: true, errors: [] } o { valid: false, errors: [...] }
function validateLoginForm(email, password) {
  const errors = [];

  if (!validateEmail(email)) {
    errors.push("El correo electrónico no es válido.");
  }
  if (!validatePassword(password)) {
    errors.push("La contraseña debe tener al menos 8 caracteres, una letra y un dígito.");
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ---------------------------------------------------------------------
// Pruebas — validadores de login
// ---------------------------------------------------------------------
console.assert(validateEmail("fan@riverside.fc") === true, "email valid");
console.assert(validateEmail("fan@riversidefc") === false, "email needs a dot");
console.assert(validateEmail("fanriverside.fc") === false, "email needs an @");

console.assert(validatePassword("Season2026") === true, "password ok");
console.assert(validatePassword("short1") === false, "password too short");
console.assert(validatePassword("allletters") === false, "password needs a digit");

console.assert(validateLoginForm("fan@riverside.fc", "Season2026").valid === true, "form valid");
console.assert(validateLoginForm("nope", "x").errors.length === 2, "form reports both errors");

// ---------------------------------------------------------------------
// Al menos una función ejecutada con datos reales del sitio (recetas)
// ---------------------------------------------------------------------
const recetasDelSitio = [
  "Anilas",
  "Tortilla de patatas",
  "Gazpacho andaluz",
  "Paella valenciana",
  "Crema catalana"
];

console.log("¿Es 'Anilas' un palíndromo?", isPalindrome("Anilas"));
console.log("¿Es 'Paella valenciana' un palíndromo?", isPalindrome("Paella valenciana"));