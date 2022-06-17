import { RedisPubSub } from "graphql-redis-subscriptions";
import { connect } from "./redis";

let pubsub: RedisPubSub;

export default async function getPubSub(): Promise<RedisPubSub> {
  if (!pubsub) {
    pubsub = new RedisPubSub({
      publisher: await connect(),
      connection: {
        host: process.env.REDIS_URL,
        port: parseInt(process.env.REDIS_PORT as string, 10),
        password: process.env.REDIS_PASSWORD,
      },
    });
  }
  return pubsub;
}
