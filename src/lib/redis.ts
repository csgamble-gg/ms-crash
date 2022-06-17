import logger from "@csgamble-gg/logger";
import RedisClient, { Redis } from "ioredis";

let client: Redis;

export const connect = async (): Promise<Redis> => {
  return new Promise(async (resolve, reject) => {
    try {
      client = new RedisClient({
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT as string, 10),
        password: process.env.REDIS_PASSWORD,
      });
      client.on("error", (err): void => {
        logger.error(`Redis Error: ${err}`);
      });

      return resolve(client);
    } catch (ex: any) {
      return reject(ex.message);
    }
  });
};

export { client };
