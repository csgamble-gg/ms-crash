import { getKafkaConsumer } from "@csgamble-gg/kafka-utils";
import logger from "@csgamble-gg/logger";
import { v4 as uuid } from "uuid";
import crash from "./game/crash";
import handler from "./handlers/handler";
import getKafkaClient from "./lib/getKafkaClient";

const server = async () => {
  logger.info(`Starting ${process.env.SERVICE_NAME}`);
  const kafkaClient = await getKafkaClient();
  const consumer = await getKafkaConsumer(
    {
      groupId: process.env.SERVICE_NAME + uuid(),
    },
    kafkaClient
  );

  await consumer.connect().then(async () => {
    (await crash()).start();
  });
  await consumer.subscribe({
    topic: "crash-commands",
  });
  await consumer.run({
    eachMessage: handler,
  });
};

server().catch((err) => logger.error(err.message));
