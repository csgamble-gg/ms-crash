import getDb from "../lib/getDb";
import getPubSub from "../lib/getPubSub";
import { CrashGameContext, Game } from "../types";

export const crashGame = async (context: CrashGameContext) => {
  const pubsub = await getPubSub();
  const db = await getDb();

  const finalizedGame: Game = {
    ...context.currentGame,
    status: "finished",
  };

  // update the game status to finished
  const updatedGame = await db.collection<Game>("games").findOneAndUpdate(
    { _id: context.currentGame._id },
    {
      $set: finalizedGame,
    },
    { returnDocument: "after" }
  );

  // update the raw game to ended
  const updatedRawGame = await db
    .collection<Game>("crash-games")
    .findOneAndUpdate(
      { _id: context.currentGame.rawGameId },
      {
        $set: {
          ended: true,
        },
      }
    );

  await pubsub.publish("crashGame", {
    crashGame: {
      crashGame: {
        ...context.currentGame,
        status: "crashed",
      },
      cashedIn: context.cashedIn,
      cashedOut: context.cashedOut,
    },
  });
};
