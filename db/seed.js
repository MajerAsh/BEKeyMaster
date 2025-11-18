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
        name: "Pin Tumbler Lock",
        prompt:
          "Align all 5 pins to the correct height to unlock the cabinet and get the treat.",
        type: "pin-tumbler",
        solution_code: JSON.stringify([40, 30, 50, 20, 60]), //stringified array
      },
      {
        name: "Dial Lock",
        prompt:
          "Follow the tips to find each number of the 3 number combination to unlock the treat.",
        type: "dial",
        solution_code: JSON.stringify([3, 1, 4]),
      },
    ];

    for (const puzzle of puzzles) {
      // Provide exactly 3 params for 3 placeholders.
      await pool.query(
        `INSERT INTO puzzles (name, prompt, type, solution_code) VALUES ($1, $2, $3, $4)`,
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
