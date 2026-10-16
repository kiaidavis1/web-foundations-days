const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// Updates both counters and the warning/over classes
function updateCounts() {
  const text = noteText.value;
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCount.textContent = chars + " / 200 characters";
  wordCount.textContent = words + " words";

  charCount.classList.toggle("warning", chars > 180 && chars <= 200);
  charCount.classList.toggle("over", chars > 200);
}

// Saves the current text as a draft
function saveDraft() {
  localStorage.setItem("draft", noteText.value);
}

// Empties the textarea, resets the counters and removes the draft
function clearAll() {
  noteText.value = "";
  localStorage.removeItem("draft");
  updateCounts();
}

// Turns dark mode on or off and updates the button label
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

// Every time the user types
noteText.addEventListener("input", function () {
  updateCounts();
  saveDraft();
});

// Escape inside the textarea clears it
noteText.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    clearAll();
  }
});

// Clear button
clearBtn.addEventListener("click", clearAll);

// Theme button
themeToggle.addEventListener("click", function () {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

// When the page loads: restore the draft and the theme, then update the counters
const savedDraft = localStorage.getItem("draft");
if (savedDraft !== null) {
  noteText.value = savedDraft;
}
applyTheme(localStorage.getItem("theme") === "dark");
updateCounts();