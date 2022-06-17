import logger from "@csgamble-gg/logger";
import { ObjectID } from "bson";
import { add } from "date-fns";
import { v4 as uuid } from "uuid";
import getDb from "../lib/getDb";
import getPubSub from "../lib/getPubSub";
import { Game } from "../types";

interface CreateGameArgs extends Partial<Game> {
  rawGameId: ObjectID;
  crashPoint: number;
  secrets: {
    serverSeed: string;
    // serverSeedHash: string;
    clientSeed: string;
  };
}

export const createGame = async (
  createGameArgs: CreateGameArgs
): Promise<Game> => {
  logger.info("Attempting to create new crash game");
  try {
    const db = await getDb();
    const pubsub = await getPubSub();
    const newGame: Game = {
      _id: new ObjectID(),
      createdAt: new Date(),
      status: "created",
      gameType: "crash",
      startsAt: new Date(add(new Date(), { seconds: 15 })),
      gameId: `crash-${uuid()}`,
      elapsed: 0,
      multiplier: 0,
      ...createGameArgs,
    };

    const createdGameId = await db.collection("games").insertOne(newGame);

    logger.info(`Crash game created with id: ${newGame.gameId}`);

    const createdGame = await db
      .collection("games")
      .findOne<Game>({ _id: createdGameId.insertedId });

    logger.info("Publishing gameCreated event to subscribers");
    await pubsub.publish("crashGame", {
      crashGame: {
        crashGame: { ...createdGame, elapsed: 0, multiplier: 0 },
        cashedIn: [],
        cashedOut: [],
      },
    });

    return createdGame as Game;
  } catch (e) {
    logger.error(e);
    throw e;
  }
};
