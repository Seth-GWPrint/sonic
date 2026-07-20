import mysql from "mysql2/promise";

function getGwPricingDbConfig() {
  const host = process.env.GW_PRICING_DB_HOST;
  const port = Number(process.env.GW_PRICING_DB_PORT || 3306);
  const user = process.env.GW_PRICING_DB_USER;
  const password = process.env.GW_PRICING_DB_PASSWORD;
  const database = process.env.GW_PRICING_DB_NAME;

  if (!host || !user || !password || !database) {
    throw new Error(
      "Missing one or more GWBuilder pricing database environment variables."
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 5,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    decimalNumbers: true,
  };
}

const globalForGwPricing = globalThis as typeof globalThis & {
  gwPricingPool?: mysql.Pool;
};

export const gwPricingPool =
  globalForGwPricing.gwPricingPool ??
  mysql.createPool(getGwPricingDbConfig());

if (process.env.NODE_ENV !== "production") {
  globalForGwPricing.gwPricingPool = gwPricingPool;
}