import { GameAction, GameActions } from "../types";
import getDb, { getMongoClient } from "../lib/getDb";
import getPubSub from "../lib/getPubSub";
import Big from "big.js";

const getPayoutMulti = (selections: Array<Number>) => {
  if (selections.length === 1) {
    return 15;
  }
  return 2;
};

const payoutBets = async (
  gameActions: Array<GameAction>,
  rollValue: number
): Promise<void> => {
  // filter out non winning selections from gameActions
  const winningBets = gameActions.filter((gameAction) => {
    if (gameAction.selections.includes(rollValue)) return gameAction;
  });

  const pubsub = await getPubSub();

  // update the gameAction in MongoDB for every winningBet
  const db = await getDb();
  const mongoClient = await getMongoClient();
  const transactionSession = await mongoClient.startSession();

  for (const winningBet of winningBets) {
    try {
      await transactionSession.withTransaction(async () => {
        const gameAction = await db
          .collection("game-actions")
          .findOneAndUpdate(
            { _id: winningBet._id },
            { $set: { type: GameActions.Win } }
          );

        const updatedUser = await db.collection("users").findOneAndUpdate(
          { _id: (gameAction.value as GameAction).user._id },
          {
            $inc: {
              balance: new Big(winningBet.amount)
                .mul(getPayoutMulti(winningBet.selections))
                .toNumber(),
            },
          },
          { returnDocument: "after" }
        );

        await pubsub.publish("userEvent", {
          userEvent: {
            type: "BalanceUpdate",
            user: {
              ...updatedUser.value,
              balance: new Big((updatedUser.value as any).balance)
                .div(100)
                .toNumber(),
            },
          },
        });
        await transactionSession.commitTransaction();
      });
    } catch (error) {
      console.error("Failed while paying out bets ;(");
      await transactionSession.abortTransaction();
    } finally {
      await transactionSession.endSession();
    }
  }
};

export default payoutBets;
