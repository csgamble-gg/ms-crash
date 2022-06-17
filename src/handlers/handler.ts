import { EachMessagePayload } from "kafkajs";
import { KafkaCommand } from "../types";
import handleCashout from "./handleCashout";
import handleCreateBet from "./handleCreateBet";

const handler = async ({ message }: EachMessagePayload): Promise<void> => {
  // invalid message
  if (!message.value) return;
  const command = JSON.parse(message.value.toString()) as KafkaCommand;

  // validate the complete command
  //   await validatePayload(command);

  const { type, data } = command;

  switch (type) {
    case "CreateCrashBet":
      handleCreateBet(data);
      break;
    case "CashoutCrashBet":
      handleCashout(data);
      break;

    default:
      break;
  }
};

export default handler;
