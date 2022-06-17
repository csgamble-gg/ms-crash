import logger from "@csgamble-gg/logger";
import Big from "big.js";
import getDb from "../lib/getDb";
import { CrashGameContext, Game } from "../types";

const CrashSpeed = 0.00006;

export const getMultiplier = (elapsed: number): number =>
  Math.max(1, Math.E ** (CrashSpeed * elapsed));

const getAbsoluteMultiplier = (multiplier: number): number => {
  return new Big(multiplier.toFixed(2)).times(100).toNumber();
};

export const startGame =
  (context: CrashGameContext) => async (callback: any) => {
    logger.info(`Starting crash game`);
    const db = await getDb();

    let baseGame: Game = {
      ...context.currentGame,
      multiplier: 0,
      elapsed: 0,
      status: "in-progress",
    };

    // write the new game status to the database
    const updatedGame = await db.collection<Game>("games").findOneAndUpdate(
      { _id: context.currentGame._id },
      {
        $set: baseGame,
      },
      { returnDocument: "after" }
    );

    callback({ type: "UPDATE_CONTEXT", data: updatedGame.value });

    // elapsed = time past in ms
    let elapsed = 0;
    const interval = setInterval(async () => {
      const multiplier = getMultiplier(elapsed);
      baseGame = {
        ...baseGame,
        multiplier,
        elapsed,
      };

      callback({
        type: "UPDATE_CONTEXT",
        data: {
          ...updatedGame.value,
          multiplier,
        },
      });

      callback({ type: "TICK", data: baseGame });

      elapsed += 10;
      console.log(
        getAbsoluteMultiplier(multiplier),
        context.currentGame.crashPoint
      );
      if (getAbsoluteMultiplier(multiplier) >= context.currentGame.crashPoint) {
        callback({ type: "CRASH", data: baseGame });
        clearInterval(interval);
      }
    }, 10);
  };
