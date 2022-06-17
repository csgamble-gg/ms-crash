import crash from "../game/crash";
import { KafkaCommand } from "../types";
import produceUserError from "../utils/produceUserError";

const handleCashout = async ({
  sessionId,
  gameId,
  bet,
}: KafkaCommand["data"]) => {
  const crashMachine = await crash();
  const { currentGame } = crashMachine.state.context;

  // verify there is an active game
  if (!currentGame) {
    return await produceUserError(sessionId, "No game exists. Contact support");
  }

  // check the game is running
  if (currentGame.status !== "in-progress") {
    return await produceUserError(
      sessionId,
      "You cannot cashout a game that is not in progress"
    );
  }

  // if the incoming betId is not the same as the current gameId, ignore the message
  if (gameId !== currentGame.gameId.toString()) {
    return await produceUserError(sessionId, "Invalid bet");
  }

  // send the cashout event to our state machine
  crashMachine.send({
    type: "CASHOUT_BET",
    data: bet,
  });
};

export default handleCashout;
