//Seed puzzle data
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedPuzzles() {
  try {
    // Clear existing puzzles (optional)
    await pool.query("DELETE FROM puzzles");

    // Example: Pin tumbler puzzle
    const puzzles = [
      {
        name: "The Vault",
        prompt: "Align all 5 pins to the correct height to unlock the vault.",
        solution_code: JSON.stringify([40, 30, 50, 20, 60]), // stored as a stringified array
      },
      {
        name: "Simple Dial Lock",
        prompt: "Set the combination to unlock the dial: 3-1-4",
        solution_code: JSON.stringify([3, 1, 4]),
      },
    ];

    for (const puzzle of puzzles) {
      await pool.query(
        `INSERT INTO puzzles (name, prompt, solution_code) VALUES ($1, $2, $3)`,
        [puzzle.name, puzzle.prompt, puzzle.type, puzzle.solution_code]
      );
    }

    console.log("🍾 Puzzles seeded successfully.");
  } catch (err) {
    console.error("😒 Error seeding puzzles:", err);
  } finally {
    await pool.end();
  }
}

seedPuzzles();
