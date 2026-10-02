let notes = [
  { id: 1, text: "Call Lilian😚", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to HR", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Watch Mancherster derby", category: "personal" },
];
// Returns notes whose text contains the word, ignoring upper/lower case
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter(function (note) {
    return note.text.toLowerCase().includes(search);
  });
}

// Returns the note with the most characters, or null if there are no notes
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

// Tests for searchNotes
console.log(searchNotes("REVISE"));
// Expected: [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]

console.log(searchNotes("zebra"));
// Expected: []

// Tests for longestNote
console.log(longestNote());
// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }

let savedNotes = notes;
notes = [];
console.log(longestNote());
// Expected: null
notes = savedNotes;
// Returns an object counting notes per category
function countByCategory() {
  const counts = {};
  for (let i = 0; i < notes.length; i++) {
    const category = notes[i].category;
    if (counts[category]) {
      counts[category] = counts[category] + 1;
    } else {
      counts[category] = 1;
    }
  }
  return counts;
}

// Returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const total = notes.length;
  if (total === 0) {
    return "0 notes.";
  }
  const counts = countByCategory();
  const word = total === 1 ? "note" : "notes";
  const categories = ["personal", "work", "study"];
  const parts = [];
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    if (counts[category]) {
      parts.push(counts[category] + " " + category);
    }
  }
  return `${total} ${word}: ${parts.join(", ")}.`;
}

// Removes extra spaces and upper/lower case so texts can be compared
function cleanText(text) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

// Returns true if a note with the same text already exists
function isDuplicate(text) {
  const clean = cleanText(text);
  return notes.some(function (note) {
    return cleanText(note.text) === clean;
  });
}

// Adds a note if it is valid. Returns true when added, false otherwise.
function addNote(text, category) {
  const validCategories = ["personal", "work", "study"];
  const trimmed = typeof text === "string" ? text.trim() : "";

  if (trimmed.length < 1 || trimmed.length > 200) {
    console.log("Not added: text must be 1 to 200 characters.");
    return false;
  }
  if (isDuplicate(trimmed)) {
    console.log("Not added: a note with this text already exists.");
    return false;
  }
  if (!validCategories.includes(category)) {
    console.log("Not added: category must be personal, work or study.");
    return false;
  }

  let newId = 1;
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].id >= newId) {
      newId = notes[i].id + 1;
    }
  }
  notes.push({ id: newId, text: trimmed, category: category });
  return true;
}

// Tests for countByCategory
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }

notes = [];
console.log(countByCategory());
// Expected: {}
notes = savedNotes;

// Tests for getSummary
console.log(getSummary());
// Expected: "5 notes: 2 personal, 1 work, 2 study."

notes = [{ id: 1, text: "Call mum", category: "personal" }];
console.log(getSummary());
// Expected: "1 note: 1 personal."
notes = savedNotes;

// Tests for isDuplicate
console.log(isDuplicate("  buy MILK   and bread "));
// Expected: true

console.log(isDuplicate("Water the plants"));
// Expected: false

// Tests for addNote
console.log(addNote("Water the plants", "personal"));
// Expected: true

console.log(addNote("water the plants", "personal"));
// Expected: "Not added: a note with this text already exists." then false

console.log(addNote("", "work"));
// Expected: "Not added: text must be 1 to 200 characters." then false

console.log(addNote("a".repeat(201), "work"));
// Expected: "Not added: text must be 1 to 200 characters." then false

console.log(addNote("Plan a trip", "fun"));
// Expected: "Not added: category must be personal, work or study." then false

console.log(getSummary());
// Expected: "6 notes: 3 personal, 1 work, 2 study."