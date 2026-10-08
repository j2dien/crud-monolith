export function assertTestEnvironment() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Test stopped: NODE_ENV must be test.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Test stopped: DATABASE_URL is missing.",
    );
  }

  const url = new URL(databaseUrl);

  const valid =
    ["postgres:", "postgresql:"].includes(
      url.protocol,
    ) &&
    ["localhost", "127.0.0.1"].includes(
      url.hostname,
    ) &&
    url.port === "5435" &&
    url.pathname === "/crud_app_test" &&
    url.username === "crud_test";

  if (!valid) {
    throw new Error(
      "Test stopped: database must match the local test configuration.",
    );
  }
}

assertTestEnvironment();