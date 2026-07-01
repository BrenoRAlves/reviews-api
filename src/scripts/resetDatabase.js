const fs = require("fs");
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "..", "database.db");
const filesToDelete = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
let deletedAnyFile = false;

for (const filePath of filesToDelete) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deletedAnyFile = true;
    console.log(`Deleted ${path.basename(filePath)}.`);
  }
}

if (!deletedAnyFile) {
  console.log("No database files found.");
}

console.log("Run npm run dev to recreate and seed the database.");
