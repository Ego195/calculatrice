const matrixState = {
  a: {
    values: [[1, 2, 3], [4, 5, 6]],
  },
  b: {
    values: [[7, 8], [9, -1], [-2, -3]],
  },
  scalar: "2",
};

const operationSelect = document.querySelector("#matrix-operation");
const resultTitle = document.querySelector("#result-title");
const resultContainer = document.querySelector("#matrix-result");
const matrixStatus = document.querySelector("#matrix-status");
const matrixScalar = document.querySelector("#matrix-scalar");
const scalarRow = document.querySelector("#scalar-row");
const displayValue = document.querySelector("#display-value");
const displayExpression = document.querySelector("#display-expression");
let calculatorMode = "matrix";
let activeMatrix = "a";
let activeRow = 0;
let activeCol = 0;
let matrixEntryPending = true;
let scalarEntryPending = true;
let currentInput = "0";
let storedValue = null;
let pendingOperator = null;
let shouldStartNewInput = false;
let calculatorError = false;

const editorElements = {
  a: {
    rows: document.querySelector("#matrix-a-rows"),
    cols: document.querySelector("#matrix-a-cols"),
    grid: document.querySelector("#matrix-a-grid"),
  },
  b: {
    rows: document.querySelector("#matrix-b-rows"),
    cols: document.querySelector("#matrix-b-cols"),
    grid: document.querySelector("#matrix-b-grid"),
  },
};

const operationLabels = {
  add: "A + B",
  subtract: "A − B",
  multiply: "A × B",
  divide: "A ÷ B",
  scalarA: "k × A",
  scalarB: "k × B",
  detA: "det(A)",
  detB: "det(B)",
  inverseA: "A⁻¹",
  inverseB: "B⁻¹",
};

function resizeMatrix(matrix, rows, cols) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => matrix[row]?.[col] ?? 0),
  );
}

function buildEditor(key) {
  const matrix = matrixState[key];
  const elements = editorElements[key];
  const rows = Number(elements.rows.value);
  const cols = Number(elements.cols.value);

  matrix.values = resizeMatrix(matrix.values, rows, cols);
  if (activeMatrix === key) {
    activeRow = Math.min(activeRow, rows - 1);
    activeCol = Math.min(activeCol, cols - 1);
  }
  elements.grid.replaceChildren();
  elements.grid.style.gridTemplateColumns = `repeat(${cols}, max-content)`;

  matrix.values.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const input = document.createElement("input");
      input.className = "matrix-cell";
      input.type = "text";
      input.inputMode = "decimal";
      input.value = String(value);
      input.setAttribute("aria-label", `Matrice ${key.toUpperCase()}, ligne ${rowIndex + 1}, colonne ${colIndex + 1}`);
      input.addEventListener("focus", () => setActiveCell(key, rowIndex, colIndex, false));
      input.addEventListener("input", () => {
        const enteredValue = input.value.trim().replace(",", ".");
        matrix.values[rowIndex][colIndex] = enteredValue === "" || enteredValue === "-" || enteredValue === "." || enteredValue === "-."
          ? null
          : Number(enteredValue);
        matrixEntryPending = false;
        renderMatrixDisplay();
        updateMatrixResult();
      });
      elements.grid.append(input);
    });
  });
  if (activeMatrix === key) setActiveCell(key, activeRow, activeCol, false);
  updateMatrixResult();
}

function initializeEditor(key) {
  const elements = editorElements[key];

  [elements.rows, elements.cols].forEach((select, index) => {
    for (let size = 1; size <= 6; size += 1) {
      const option = document.createElement("option");
      option.value = String(size);
      option.textContent = String(size);
      select.append(option);
    }
    select.value = String(index === 0 ? matrixState[key].values.length : matrixState[key].values[0].length);
    select.addEventListener("change", () => buildEditor(key));
  });

  buildEditor(key);
}

function determinant(matrix) {
  if (matrix.length === 1) return matrix[0][0];
  let total = 0;
  for (let col = 0; col < matrix.length; col += 1) {
    const minor = matrix.slice(1).map((row) => row.filter((_, index) => index !== col));
    total += (col % 2 === 0 ? 1 : -1) * matrix[0][col] * determinant(minor);
  }
  return total;
}

function inverse(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, col) => (index === col ? 1 : 0)),
  ]);
  const tolerance = 1e-12;

  for (let pivotCol = 0; pivotCol < size; pivotCol += 1) {
    let pivotRow = pivotCol;
    for (let row = pivotCol + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivotCol]) > Math.abs(augmented[pivotRow][pivotCol])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][pivotCol]) < tolerance) return null;
    [augmented[pivotCol], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivotCol]];

    const pivot = augmented[pivotCol][pivotCol];
    augmented[pivotCol] = augmented[pivotCol].map((value) => value / pivot);
    for (let row = 0; row < size; row += 1) {
      if (row === pivotCol) continue;
      const factor = augmented[row][pivotCol];
      augmented[row] = augmented[row].map((value, col) => value - factor * augmented[pivotCol][col]);
    }
  }

  return augmented.map((row) => row.slice(size));
}

function performMatrixOperation(a, b, operation) {
  if (operation === "add" || operation === "subtract") {
    if (a.length !== b.length || a[0].length !== b[0].length) {
      return { error: "L'addition et la soustraction exigent des matrices de même dimension." };
    }
    const sign = operation === "add" ? 1 : -1;
    return {
      values: a.map((row, i) => row.map((value, j) => value + sign * b[i][j])),
    };
  }

  if (operation === "multiply") {
    if (a[0].length !== b.length) {
      return { error: `Produit impossible : le nombre de colonnes de A (${a[0].length}) doit égaler le nombre de lignes de B (${b.length}).` };
    }
    return {
      values: a.map((row) =>
        b[0].map((_, col) =>
          row.reduce((sum, value, index) => sum + value * b[index][col], 0),
        ),
      ),
    };
  }

  if (b.length !== b[0].length) {
    return { error: "La division A ÷ B exige une matrice B carrée et inversible." };
  }
  const inverseB = inverse(b);
  if (inverseB === null) {
    return { error: "La matrice B est singulière (déterminant nul) : son inverse n'existe pas." };
  }
  if (a[0].length !== inverseB.length) {
    return { error: `Division impossible : A doit avoir ${inverseB.length} colonne(s) pour être multipliée par B⁻¹.` };
  }
  return {
    values: a.map((row) =>
      inverseB[0].map((_, col) =>
        row.reduce((sum, value, index) => sum + value * inverseB[index][col], 0),
      ),
    ),
  };
}

function formatNumber(value) {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(normalized);
}

function showMatrixResult(values) {
  const grid = document.createElement("div");
  grid.className = "result-grid";
  grid.style.gridTemplateColumns = `repeat(${values[0].length}, minmax(43px, 1fr))`;
  values.flat().forEach((value) => {
    const cell = document.createElement("span");
    cell.className = "result-value";
    cell.textContent = formatNumber(value);
    grid.append(cell);
  });
  resultContainer.replaceChildren(grid);
}

function showScalarResult(value) {
  const result = document.createElement("span");
  result.className = "result-scalar";
  result.textContent = formatNumber(value);
  resultContainer.replaceChildren(result);
}

function updateMatrixResult() {
  const operation = operationSelect.value;
  resultTitle.textContent = operationLabels[operation];
  scalarRow.hidden = operation !== "scalarA" && operation !== "scalarB";
  const a = matrixState.a.values;
  const b = matrixState.b.values;
  const target = operation.endsWith("B") ? b : a;
  const needsBothMatrices = ["add", "subtract", "multiply", "divide"].includes(operation);
  const valuesToCheck = needsBothMatrices ? [...a.flat(), ...b.flat()] : target.flat();
  if ((operation === "scalarA" || operation === "scalarB")
    && (!matrixState.scalar.trim() || !Number.isFinite(Number(matrixState.scalar)))) {
    valuesToCheck.push(Number.NaN);
  }
  if (!valuesToCheck.every(Number.isFinite)) {
    resultContainer.replaceChildren();
    const error = document.createElement("div");
    error.className = "result-error";
    error.textContent = "⚠ Saisissez des valeurs numériques valides.";
    resultContainer.append(error);
    matrixStatus.textContent = "Complétez la cellule active avec une valeur numérique.";
    return;
  }

  if (operation === "detA" || operation === "detB") {
    if (target.length !== target[0].length) {
      resultContainer.replaceChildren();
      const error = document.createElement("div");
      error.className = "result-error";
      error.textContent = "⚠ Le déterminant se calcule uniquement sur une matrice carrée.";
      resultContainer.append(error);
      matrixStatus.textContent = "Modifiez les dimensions pour obtenir une matrice carrée.";
      return;
    }
    showScalarResult(determinant(target));
    matrixStatus.textContent = `Déterminant calculé · matrice ${operation.endsWith("B") ? "B" : "A"}.`;
    return;
  }

  if (operation === "inverseA" || operation === "inverseB") {
    if (target.length !== target[0].length) {
      resultContainer.replaceChildren();
      const error = document.createElement("div");
      error.className = "result-error";
      error.textContent = "⚠ L'inverse se calcule uniquement sur une matrice carrée.";
      resultContainer.append(error);
      matrixStatus.textContent = "Modifiez les dimensions pour obtenir une matrice carrée.";
      return;
    }
    const inverseValues = inverse(target);
    if (inverseValues === null) {
      resultContainer.replaceChildren();
      const error = document.createElement("div");
      error.className = "result-error";
      error.textContent = "⚠ Cette matrice est singulière : son inverse n'existe pas.";
      resultContainer.append(error);
      matrixStatus.textContent = "Le déterminant de la matrice est nul.";
      return;
    }
    showMatrixResult(inverseValues);
    matrixStatus.textContent = `Inverse calculé · matrice ${operation.endsWith("B") ? "B" : "A"}.`;
    return;
  }

  if (operation === "scalarA" || operation === "scalarB") {
    const scalar = Number(matrixState.scalar);
    showMatrixResult(target.map((row) => row.map((value) => value * scalar)));
    matrixStatus.textContent = `Chaque valeur de la matrice est multipliée par k = ${formatNumber(scalar)}.`;
    return;
  }

  const result = performMatrixOperation(a, b, operation);
  if (result.error) {
    resultContainer.replaceChildren();
    const error = document.createElement("div");
    error.className = "result-error";
    error.textContent = `⚠ ${result.error}`;
    resultContainer.append(error);
    matrixStatus.textContent = "Vérifiez les dimensions ou les conditions de l'opération.";
    return;
  }

  showMatrixResult(result.values);
  matrixStatus.textContent = "Résultat actualisé à l'instant.";
}

operationSelect.addEventListener("change", () => {
  scalarEntryPending = true;
  renderMatrixDisplay();
  updateMatrixResult();
});
matrixScalar.addEventListener("input", () => {
  matrixState.scalar = matrixScalar.value.trim().replace(",", ".");
  scalarEntryPending = false;
  renderMatrixDisplay();
  updateMatrixResult();
});
initializeEditor("a");
initializeEditor("b");

function getActiveCell() {
  const cells = editorElements[activeMatrix].grid.querySelectorAll(".matrix-cell");
  return cells[activeRow * matrixState[activeMatrix].values[0].length + activeCol];
}

function renderMatrixDisplay() {
  const isScalar = operationSelect.value === "scalarA" || operationSelect.value === "scalarB";
  if (isScalar) {
    displayExpression.textContent = "SCALAIRE · VALEUR k";
    displayValue.textContent = matrixState.scalar || "0";
    return;
  }
  displayExpression.textContent = `MATRICE ${activeMatrix.toUpperCase()} · LIGNE ${activeRow + 1}, COLONNE ${activeCol + 1}`;
  displayValue.textContent = getActiveCell()?.value || "0";
}

function setActiveCell(key, row, col, focus = true) {
  activeMatrix = key;
  activeRow = row;
  activeCol = col;
  document.querySelectorAll(".matrix-cell").forEach((cell) => cell.classList.remove("is-selected"));
  const cell = getActiveCell();
  if (!cell) return;
  cell.classList.add("is-selected");
  matrixEntryPending = true;
  if (focus) cell.focus();
  renderMatrixDisplay();
  document.querySelector("#active-cell-label").textContent =
    `CELLULE ACTIVE · ${key.toUpperCase()}[${row + 1}, ${col + 1}]`;
}

function moveMatrixSelection(direction) {
  const values = matrixState[activeMatrix].values;
  const rows = values.length;
  const cols = values[0].length;

  if (direction === "up" || direction === "down") {
    activeRow = Math.max(0, Math.min(rows - 1, activeRow + (direction === "up" ? -1 : 1)));
  } else if (direction === "right") {
    if (activeCol < cols - 1) activeCol += 1;
    else if (activeRow < rows - 1) {
      activeRow += 1;
      activeCol = 0;
    } else if (activeMatrix === "a") {
      activeMatrix = "b";
      activeRow = 0;
      activeCol = 0;
    }
  } else if (direction === "left") {
    if (activeCol > 0) activeCol -= 1;
    else if (activeRow > 0) {
      activeRow -= 1;
      activeCol = cols - 1;
    } else if (activeMatrix === "b") {
      activeMatrix = "a";
      activeRow = matrixState.a.values.length - 1;
      activeCol = matrixState.a.values[0].length - 1;
    }
  }
  setActiveCell(activeMatrix, activeRow, activeCol);
}

function updateActiveMatrixCell(value) {
  const cell = getActiveCell();
  if (!cell) return;
  cell.value = value;
  const normalized = value.trim().replace(",", ".");
  matrixState[activeMatrix].values[activeRow][activeCol] =
    normalized === "" || normalized === "-" || normalized === "." || normalized === "-."
      ? null
      : Number(normalized);
  matrixEntryPending = false;
  renderMatrixDisplay();
  updateMatrixResult();
}

function updateScalarFromKey(key) {
  let value = matrixState.scalar;
  if (key === "sign") {
    value = value.startsWith("-") ? value.slice(1) : `-${value}`;
    scalarEntryPending = false;
  } else if (key === "decimal") {
    if (scalarEntryPending || !value) value = "0.";
    else if (!value.includes(".") && !value.includes(",")) value += ".";
    scalarEntryPending = false;
  } else if (key === "clear") {
    value = "0";
    scalarEntryPending = true;
  } else if (key === "backspace") {
    value = value.slice(0, -1) || "0";
    scalarEntryPending = false;
  } else {
    value = scalarEntryPending || value === "0" ? key : `${value}${key}`;
    scalarEntryPending = false;
  }
  matrixState.scalar = value.replace(",", ".");
  matrixScalar.value = value;
  renderMatrixDisplay();
  updateMatrixResult();
}

function handleMatrixKey(key) {
  if (key === "decimal" || key === "sign" || key === "clear" || key === "backspace") {
    if (operationSelect.value === "scalarA" || operationSelect.value === "scalarB") {
      updateScalarFromKey(key);
      return;
    }
    const cell = getActiveCell();
    const value = cell?.value || "0";
    if (key === "clear") updateActiveMatrixCell("0");
    if (key === "backspace") updateActiveMatrixCell(value.length > 1 ? value.slice(0, -1) : "0");
    if (key === "sign") updateActiveMatrixCell(value.startsWith("-") ? value.slice(1) : `-${value}`);
    if (key === "decimal") {
      updateActiveMatrixCell(matrixEntryPending ? "0." : value.includes(".") ? value : `${value}.`);
    }
    matrixEntryPending = false;
    return;
  }

  if (operationSelect.value === "scalarA" || operationSelect.value === "scalarB") {
    updateScalarFromKey(key);
    return;
  }

  const cell = getActiveCell();
  const current = cell?.value || "";
  updateActiveMatrixCell(matrixEntryPending || current === "0" ? key : `${current}${key}`);
}

function replayModeAnimation(elements) {
  elements.forEach((element) => {
    element.classList.remove("mode-enter");
    void element.offsetWidth;
    element.classList.add("mode-enter");
  });
}

document.addEventListener("animationend", (event) => {
  if (event.animationName === "mode-enter") event.target.classList.remove("mode-enter");
});

document.querySelectorAll(".calc-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    calculatorMode = tab.dataset.calculatorMode;
    document.body.classList.toggle("standard-mode", calculatorMode === "standard");
    document.querySelectorAll(".calc-tab").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelector("#matrix-workflow").hidden = calculatorMode !== "matrix";
    document.querySelector("#matrix-controls").hidden = calculatorMode !== "matrix";
    document.querySelector("#keypad").hidden = calculatorMode !== "standard";
    if (calculatorMode === "matrix") renderMatrixDisplay();
    else renderCalculator();

    const transitionTargets = [document.querySelector("#calculator")];
    if (calculatorMode === "matrix") {
      transitionTargets.push(
        document.querySelector("#matrix-workflow"),
        document.querySelector("#matrix-controls"),
        document.querySelector(".result-card"),
      );
    } else {
      transitionTargets.push(document.querySelector(".display"), document.querySelector("#keypad"));
    }
    replayModeAnimation(transitionTargets);
  });
});

document.querySelector("#matrix-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.number !== undefined) handleMatrixKey(button.dataset.number);
  if (button.dataset.matrixAction) handleMatrixKey(button.dataset.matrixAction);
  if (button.dataset.move) moveMatrixSelection(button.dataset.move);
});

setActiveCell("a", 0, 0, false);

function renderCalculator() {
  displayValue.textContent = currentInput;
  displayExpression.textContent = pendingOperator
    ? `${storedValue} ${pendingOperator}`
    : calculatorError
      ? "OPÉRATION IMPOSSIBLE"
      : "EGO · CALCULATRICE";
  document.querySelector(".calc-status").innerHTML = calculatorError
    ? "<i></i> ERREUR"
    : '<i></i> PRÊTE';
}

function clearCalculator() {
  currentInput = "0";
  storedValue = null;
  pendingOperator = null;
  shouldStartNewInput = false;
  calculatorError = false;
  renderCalculator();
}

function enterNumber(number) {
  if (calculatorError) clearCalculator();
  if (shouldStartNewInput) {
    currentInput = number;
    shouldStartNewInput = false;
  } else if (currentInput === "0") {
    currentInput = number;
  } else if (currentInput.replace("-", "").length < 14) {
    currentInput += number;
  }
  renderCalculator();
}

function showCalculatorError() {
  currentInput = "Erreur";
  storedValue = null;
  pendingOperator = null;
  shouldStartNewInput = true;
  calculatorError = true;
  renderCalculator();
}

function calculate(left, right, operator) {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  if (operator === "÷") return right === 0 ? null : left / right;
  return right;
}

function formatCalculatorValue(value) {
  if (!Number.isFinite(value)) return null;
  return String(Number(value.toPrecision(11)));
}

function chooseOperator(operator) {
  if (calculatorError) return;
  const value = Number(currentInput);
  if (pendingOperator && !shouldStartNewInput) {
    const result = calculate(storedValue, value, pendingOperator);
    const formatted = result === null ? null : formatCalculatorValue(result);
    if (formatted === null) {
      showCalculatorError();
      return;
    }
    currentInput = formatted;
    storedValue = result;
  } else {
    storedValue = value;
  }
  pendingOperator = operator;
  shouldStartNewInput = true;
  renderCalculator();
}

function evaluate() {
  if (!pendingOperator || storedValue === null || calculatorError) return;
  const expression = `${storedValue} ${pendingOperator} ${currentInput}`;
  const result = calculate(storedValue, Number(currentInput), pendingOperator);
  const formatted = result === null ? null : formatCalculatorValue(result);
  if (formatted === null) {
    showCalculatorError();
    return;
  }
  currentInput = formatted;
  storedValue = null;
  pendingOperator = null;
  shouldStartNewInput = true;
  renderCalculator();
  displayExpression.textContent = expression;
}

function handleCalculatorAction(action) {
  if (action === "clear") clearCalculator();
  if (action === "equals") evaluate();
  if (action === "decimal" && !calculatorError) {
    if (shouldStartNewInput) {
      currentInput = "0.";
      shouldStartNewInput = false;
    } else if (!currentInput.includes(".")) {
      currentInput += ".";
    }
    renderCalculator();
  }
  if (action === "sign" && !calculatorError) {
    currentInput = String(Number(currentInput) * -1);
    renderCalculator();
  }
  if (action === "percent" && !calculatorError) {
    currentInput = formatCalculatorValue(Number(currentInput) / 100);
    renderCalculator();
  }
}

document.querySelector("#keypad").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.number !== undefined) enterNumber(button.dataset.number);
  if (button.dataset.operator) chooseOperator(button.dataset.operator);
  if (button.dataset.action) handleCalculatorAction(button.dataset.action);
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (document.body.classList.contains("startup-running")) return;
  const target = event.target;
  const isMatrixCell = target instanceof HTMLInputElement && target.classList.contains("matrix-cell");

  if (calculatorMode === "matrix") {
    const directions = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    if (directions[event.key] && (isMatrixCell || !(target instanceof HTMLInputElement || target instanceof HTMLSelectElement))) {
      event.preventDefault();
      moveMatrixSelection(directions[event.key]);
      return;
    }
    if (isMatrixCell && event.key === "Enter") {
      event.preventDefault();
      moveMatrixSelection("right");
      return;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target.isContentEditable) return;
    if (/^\d$/.test(event.key)) handleMatrixKey(event.key);
    else if (event.key === "." || event.key === ",") handleMatrixKey("decimal");
    else if (event.key === "-") handleMatrixKey("sign");
    else if (event.key === "Backspace") handleMatrixKey("backspace");
    return;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target.isContentEditable) return;

  if (/^\d$/.test(event.key)) enterNumber(event.key);
  else if (event.key === "." || event.key === ",") handleCalculatorAction("decimal");
  else if (["+", "-", "*", "/"].includes(event.key)) {
    chooseOperator({ "+": "+", "-": "−", "*": "×", "/": "÷" }[event.key]);
  } else if (event.key === "Enter" || event.key === "=") evaluate();
  else if (event.key === "Escape") clearCalculator();
  else if (event.key === "Backspace" && !calculatorError) {
    currentInput = currentInput.length > 1 ? currentInput.slice(0, -1) : "0";
    renderCalculator();
  }
});

renderMatrixDisplay();
updateMatrixResult();

const customCursor = document.querySelector(".custom-cursor");
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.body.classList.add("custom-cursor-enabled");
  window.addEventListener("pointermove", (event) => {
    customCursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
    customCursor.classList.add("is-visible");
  });
  window.addEventListener("pointerdown", () => customCursor.classList.add("is-pressed"));
  window.addEventListener("pointerup", () => customCursor.classList.remove("is-pressed"));
  window.addEventListener("blur", () => customCursor.classList.remove("is-visible", "is-pressed"));
}

const startupScreen = document.querySelector("#startup-screen");
const skipStartupButton = document.querySelector("#skip-startup");
const revealTargets = document.querySelectorAll("[data-reveal]");
const bioReveal = document.querySelector("#bio-reveal");
let startupTimer;
let startupComplete = false;

function startScrollReveals() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealTargets.forEach((element) => element.classList.add("is-revealed"));
    return;
  }

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  revealTargets.forEach((element) => revealObserver.observe(element));
}

function finishStartup() {
  if (startupComplete) return;
  startupComplete = true;
  window.clearTimeout(startupTimer);
  startupScreen.classList.add("is-finished");
  startupScreen.hidden = true;
  document.body.classList.remove("startup-running");
  startScrollReveals();
}

document.body.classList.add("startup-running");
skipStartupButton.addEventListener("click", finishStartup);

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  finishStartup();
} else {
  startupTimer = window.setTimeout(finishStartup, 8000);
}

function revealBioOnScroll() {
  if (document.body.classList.contains("startup-running")) return;
  const bounds = bioReveal.getBoundingClientRect();
  const isInView = bounds.top < window.innerHeight * 0.86 && bounds.bottom > window.innerHeight * 0.12;
  if (!isInView) return;
  bioReveal.classList.add("is-visible");
  bioReveal.setAttribute("aria-hidden", "false");
  window.removeEventListener("scroll", revealBioOnScroll);
}

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  bioReveal.classList.add("is-visible");
  bioReveal.setAttribute("aria-hidden", "false");
} else {
  window.addEventListener("scroll", revealBioOnScroll, { passive: true });
  window.addEventListener("wheel", (event) => {
    if (event.deltaY > 0) revealBioOnScroll();
  }, { passive: true });
}
