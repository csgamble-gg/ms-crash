import logger from "@csgamble-gg/logger";
import Big from "big.js";
import { ObjectId } from "bson";
import getDb, { getMongoClient } from "../lib/getDb";
import getPubSub from "../lib/getPubSub";
import {
  Bet,
  CrashGameContext,
  Game,
  GameAction,
  User,
  Wallet,
} from "../types";

const cashoutBet = async (context: CrashGameContext, event: any) => {
  const { multiplier } = context.currentGame as Game;
  const userBet = context.cashedIn.find(
    (bet: Bet) => bet._id.toString() === event.data._id
  );

  // if somehow there is no bet for this user, just return
  if (!userBet) {
    return;
  }

  // nice try, if a bet has already been cashed out, just return
  if (userBet.action === "win") {
    return;
  }

  const db = await getDb();
  const pubsub = await getPubSub();

  const winAmount = new Big(userBet.amount).times(multiplier).toNumber();

  const mongoClient = await getMongoClient();
  const transactionSession = mongoClient.startSession();

  let newContext = {
    ...context,
  };

  try {
    await transactionSession.withTransaction(async () => {
      const updatedUser = await db.collection<User>("users").findOneAndUpdate(
        { _id: userBet.user._id, "wallets.type": userBet.currency },
        {
          $inc: {
            "wallets.$.balance": +winAmount,
          },
        },
        { returnDocument: "after" }
      );

      if (!updatedUser.value) {
        throw new Error("User not found");
      }

      const updatedGameAction = await db
        .collection<GameAction>("game-actions")
        .findOneAndUpdate(
          { _id: new ObjectId(userBet._id.toString()) },
          {
            $set: {
              action: "win",
              amount: winAmount,
              payoutMultiplier: multiplier,
            },
          },
          { returnDocument: "after" }
        );

      // publish the users new balance
      await pubsub.publish("availableBalances", {
        availableBalances: {
          userId: userBet.user._id,
          amount: winAmount,
          balance: {
            currency: userBet.currency,
            amount: (
              updatedUser.value.wallets.find(
                (wallet: Wallet) => wallet.type === userBet.currency
              ) as Wallet
            ).balance,
          },
        },
      });

      newContext = {
        crashGame: context.currentGame,
        cashedIn: context.cashedIn.filter(
          (bet: Bet) => bet._id.toString() !== userBet._id.toString()
        ),
        cashedOut: [
          ...context.cashedOut,
          {
            ...updatedGameAction.value,
            amount: userBet.amount,
            totalWin: winAmount,
          },
        ],
      };

      // pubsub.publish("crashGame", {
      //   crashGame: {
      //     ...newContext,
      //   },
      // });

      await transactionSession.commitTransaction();
    });
  } catch (e) {
    logger.error("Error cashing out bet", e);
  }
  return newContext;
};

export default cashoutBet;
