import logger from "@csgamble-gg/logger";
import { ObjectID } from "bson";
import getDb from "../lib/getDb";
import getPubSub from "../lib/getPubSub";
import { Game } from "../types";

interface UpdateGameOps {
  _id: ObjectID;
  status?: "started" | "finished";
  rollValue?: number;
}

export const updateGame = async (gameUpdates: UpdateGameOps): Promise<Game> => {
  logger.info(`Attempting to update roulette game with id: ${gameUpdates._id}`);
  try {
    const db = await getDb();
    const pubsub = await getPubSub();

    const updatedGame = await db
      .collection<Game>("games")
      .findOneAndUpdate(
        { _id: gameUpdates._id },
        { $set: gameUpdates },
        { returnDocument: "after" }
      );

    logger.info(`Roulette game updated with id: ${gameUpdates._id}`);

    logger.info("Publishing game updated event to subscribers");
    await pubsub.publish("rouletteGameUpdated", {
      rouletteGameUpdated: { ...updatedGame.value },
    });

    return updatedGame.value as Game;
  } catch (e) {
    logger.error(e);
    throw e;
  }
};
