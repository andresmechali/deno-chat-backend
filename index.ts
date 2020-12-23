// Parse arguments
const hostname: string = Deno.args[0];
const port: number = parseInt(Deno.args[1], 10);

// Listen for TCP connections
const listener = Deno.listen({ hostname, port });

console.log(`Server running on ${hostname}:${port}`);

for await (const conn of listener) {
    Deno.copy(conn, conn);
}
