const { createServer } = require("node:http");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    createServer((request, response) => handle(request, response))
      .listen(port, hostname, () => {
        console.log(`Next.js server listening on ${hostname}:${port}`);
      });
  })
  .catch((error) => {
    console.error("Failed to start the Next.js server:", error);
    process.exit(1);
  });
