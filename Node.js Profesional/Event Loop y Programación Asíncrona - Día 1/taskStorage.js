// taskStorage.js
const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(__dirname, "pendingTasks.json");

function loadTasks() {
  if (!fs.existsSync(FILE_PATH)) return [];
  try {
    const data = fs.readFileSync(FILE_PATH);
    return JSON.parse(data);
  } catch (err) {
    console.error("Error loading tasks:", err.message);
    return [];
  }
}

function saveTasks(tasks) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(tasks, null, 2));
  } catch (err) {
    console.error("Error saving tasks:", err.message);
  }
}

module.exports = { loadTasks, saveTasks };
