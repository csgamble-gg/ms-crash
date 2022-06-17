import Big from "big.js";
import { ObjectID } from "bson";
import crash from "../game/crash";
import getDb, { getMongoClient } from "../lib/getDb";
import getPubSub from "../lib/getPubSub";
import { GameActions, KafkaCommand, User, Wallet } from "../types";

const handleCreateBet = async ({
  gameId,
  userId,
  amount,
  currency,
  sessionId,
}: KafkaCommand["data"]): Promise<void> => {
  const pubsub = await getPubSub();
  const db = await getDb();
  const crashMachine = await crash();
  const { currentGame } = crashMachine.state.context;

  // check if there is a current game
  if (!currentGame) {
    await pubsub.publish("userError", {
      userError: {
        sessionId: sessionId,
        message: "No game exists. Contact support",
      },
    });
    return;
  }
  // check that the game is open for betting
  if (currentGame.status !== "created") {
    await pubsub.publish("userError", {
      userError: {
        sessionId: sessionId,
        message: "You cannot bet on a game that is in progress",
      },
    });
    return;
  }

  // if the incoming bet is not the same as the current gameId, ignore the message
  if (gameId !== currentGame.gameId.toString()) {
    await pubsub.publish("userError", {
      userError: {
        sessionId: sessionId,
        message: "Invalid bet",
      },
    });
    return;
  }

  // fetch the user trying to place the bet
  const user = await db.collection<User>("users").findOne({
    _id: new ObjectID(userId),
  });

  if (!user) return;

  const userWallet = user.wallets.find(
    (wallet: Wallet) => wallet.type === currency
  ) as Wallet;
  const userWalletBalance = new Big(userWallet.balance);

  // check if they have enough money to place the bet
  if (userWalletBalance.lt(amount)) {
    // if they don't send a message over pubsub
    return await pubsub.publish("userError", {
      userError: {
        sessionId: sessionId,
        message: "You do not have enough money to place this bet",
      },
    });
  }

  // start a transaction in mongo to create a bet and gameAction and reduce the user's balance
  const mongoClient = await getMongoClient();
  const transactionSession = await mongoClient.startSession();

  try {
    await transactionSession.withTransaction(async () => {
      const updatedUser = await db.collection<User>("users").findOneAndUpdate(
        {
          _id: user._id,
          "wallets.type": currency,
        },
        {
          $inc: {
            "wallets.$.balance": -amount,
          },
        },
        {
          returnDocument: "after",
        }
      );

      if (!updatedUser.value) {
        throw new Error("User not found");
      }

      const insertedBet = await db.collection("bets").insertOne({
        createdAt: new Date(),
        user: {
          _id: new ObjectID(updatedUser.value._id),
          displayName: updatedUser.value.displayName,
          avatar: updatedUser.value.avatar,
        },
        amount,
        currency,
        gameId: gameId,
      });

      const gameAction = {
        _id: new ObjectID(),
        createdAt: new Date(),
        action: GameActions.Bet,
        user: {
          _id: new ObjectID(updatedUser.value._id),
          displayName: updatedUser.value.displayName,
          avatar: updatedUser.value.avatar as string,
          steamId: updatedUser.value.steamID,
        },
        amount,
        currency,
        game: "crash",
        gameId: gameId,
        originalBetId: insertedBet.insertedId,
      };

      const insertedGameAction = await db
        .collection("game-actions")
        .insertOne(gameAction);

      await pubsub.publish("availableBalances", {
        availableBalances: {
          userId,
          // the amount we are removing / giving
          amount: amount,
          // the total balance of the wallet after the operation
          balance: {
            currency,
            amount: (
              updatedUser.value.wallets.find(
                (wallet: Wallet) => wallet.type === currency
              ) as Wallet
            ).balance,
          },
        },
      });

      crashMachine.send({
        type: "BET_CREATED",
        data: {
          ...gameAction,
          _id: insertedGameAction.insertedId,
          sessionId,
        },
      });

      await transactionSession.commitTransaction();
    });
  } catch (e) {
    console.error("Failed transaction with error: ", e);
    await transactionSession.abortTransaction();
  } finally {
    await transactionSession.endSession();
  }
};

export default handleCreateBet;
