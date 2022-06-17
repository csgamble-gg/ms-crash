import crash from "../game/crash";
import getPubSub from "../lib/getPubSub";
import { KafkaCommand } from "../types";
import produceUserError from "../utils/produceUserError";

const validatePayload = async ({ data, type }: KafkaCommand) => {
  // check for missing type on the kafka command
  if (!type) {
    throw new Error("Missing command type");
  }

  const pubsub = await getPubSub();
  const { sessionId, gameId } = data;

  // check if there is a current game - we cant execute any actions if there is no game
  const { currentGame } = (await crash()).state.context;

  if (!currentGame) {
    await produceUserError(sessionId, "No game exists. Contact support");
  }

  // check that the game is open for betting
  if (currentGame.status !== "created") {
    await produceUserError(
      sessionId,
      "You cannot bet on a game that is in progress"
    );
  }

  // if the incoming bet is not the same as the current gameId, ignore the message
  if (gameId !== currentGame.gameId.toString()) {
    await produceUserError(sessionId, "Invalid bet");
  }
};

export default validatePayload;
