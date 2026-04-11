import autocannon from "autocannon";
import { config } from "dotenv";

config(); // Load .env for port if needed

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;

async function runLoadTest() {
  console.log(`[Load Test] Starting load test against ${URL}...`);

  const result = await autocannon({
    url: URL,
    connections: 10, // Default number of concurrent connections
    duration: 10, // Duration of test in seconds
    pipelining: 1, // Number of pipelined requests
    requests: [
      {
        method: "GET",
        path: "/todos",
      },
      {
        method: "POST",
        path: "/todos",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ title: "Load Test Todo" }),
      },
      {
        method: "GET",
        path: "/users",
      },
    ],
  });

  console.log("[Load Test] Results:");
  console.log(autocannon.printResult(result));
}

runLoadTest().catch(console.error);
