import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: process.env.SERVICE_NAME,
  brokers: [process.env.KAFKA_BOOTSTRAP_SERVER as string],
  ssl: { rejectUnauthorized: false },
  sasl: {
    mechanism: "scram-sha-512",
    password: process.env.KAFKA_SASL_PASSWORD as string,
    username: process.env.KAFKA_SASL_USERNAME as string,
  },
});

const getKafkaClient = async () => {
  return kafka;
};

export default getKafkaClient;
