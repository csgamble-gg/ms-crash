import logger from "@csgamble-gg/logger";
import Big from "big.js";
import { assign, createMachine, interpret } from "xstate";
import getDb from "../lib/getDb";
import getPubSub from "../lib/getPubSub";
import {
  Bet,
  CrashGameContext,
  Game,
  GameAction,
  RawCrashGame,
} from "../types";
import cashoutBet from "./cashoutBet";
import { crashGame } from "./crashGame";
import { createGame } from "./createGame";
import { startGame } from "./startGame";

/*
  Game States: "created" | "in-progress" | "crashed"
  Flow: A game is created, we send a message to users about when the next game starts
  and wait for bets to be placed. After the startsAt time, we start the game and
  send messages to users every 10ms with updates about the game. After the game
  crashes we payout all bets and restart the game.

  State Machine Flow: createGame -> waitForBets -> startGame: onCrash -> payoutBets -> createGame

  Events Produced:
  GAME_CREATED: "gammeCreated"
  GAME_STARTED: "gameStarted"
  GAME_CRASHED: "gameCrashed"
  PAYOUT_BETS: "payoutBets"
  PLAYER_BET: "playerBet"
  PLAYER_CASHOUT: "playerCashout"


  When a player cashes out we removed their bet from the current bets and pay them
*/

type CrashEngineEvent =
  | { type: "BET_CREATED"; data: GameAction }
  | { type: "CRASH"; data: Game }
  | { type: "CASHOUT_BET"; data: Bet }
  | { type: "UPDATE_CONTEXT"; data: Game }
  | { type: "TICK"; data: Game };

export const crashMachine = async () => {
  // get the raw crash game
  // we need to find the next round, past the one that has already "ended"
  const createNewGame = async () => {
    const db = await getDb();
    const newGame = await db
      .collection<RawCrashGame>("crash-games")
      .find({ ended: false }, { sort: { round: -1 } })
      .limit(1)
      .next();

    console.log(newGame);

    if (!newGame) {
      throw new Error("Unable to query for a raw crash game");
    }

    return await createGame({
      crashPoint: newGame.crashPoint,
      rawGameId: newGame._id,
      secrets: {
        clientSeed: newGame.clientSeed,
        serverSeed: newGame.serverSeed,
      },
    });
  };

  // define the crash state machine
  const crashStateMachine = createMachine<CrashGameContext, CrashEngineEvent>(
    {
      id: "crash-game",
      initial: "createGame",
      context: {
        cashedOut: [],
        cashedIn: [],
        currentGame: {} as Game,
      },
      states: {
        createGame: {
          invoke: {
            id: "createGame",
            src: createNewGame,
            onDone: {
              target: "waitForBets",
              actions: assign({
                currentGame: (_, event) => event.data,
              }),
            },
          },
        },
        waitForBets: {
          after: {
            // 99999: {
            15000: {
              target: "startGame",
            },
          },
          on: {
            BET_CREATED: {
              actions: [
                assign((context, event) => {
                  return {
                    cashedIn: [...context.cashedIn, event.data],
                  };
                }),
                "broadcastNewBet",
              ],
            },
          },
        },
        // start the crash game, send out update events every 10ms
        startGame: {
          invoke: {
            id: "startGame",
            src: startGame,
          },
          on: {
            CASHOUT_BET: {
              actions: ["cashoutBet"],
            },
            TICK: {
              actions: ["tick"],
            },
            CRASH: {
              target: "crashGame",
              actions: assign({
                currentGame: (_, event) => event.data,
              }),
            },
            UPDATE_CONTEXT: {
              actions: assign((context, event) => {
                return {
                  ...context,
                  currentGame: event.data,
                };
              }),
            },
          },
        },
        crashGame: {
          invoke: {
            id: "crashGame",
            src: crashGame,
            onDone: {
              actions: assign(() => ({
                cashedIn: [],
                cashedOut: [],
                currentGame: [],
              })),
            },
          },
          after: {
            2000: {
              target: "createGame",
            },
          },
        },
      },
    },
    {
      actions: {
        resetContext: assign(() => ({
          cashedIn: [],
          cashedOut: [],
          currentGame: [],
        })),
        tick: async (context, event) => {
          const pubsub = await getPubSub();
          await pubsub.publish("crashGame", {
            crashGame: {
              ...context,
              crashGame: event.data,
            },
          });
        },
        cashoutBet: assign((context, event) => {
          cashoutBet(context, event);
          const cashedOutBet = {
            ...event.data,
            payoutMultiplier: context?.currentGame?.multiplier,
            amount: new Big((event.data as GameAction).amount)
              .times(context.currentGame.multiplier)
              .toNumber(),
          };
          return {
            ...context,
            cashedIn: [
              ...context.cashedIn.filter(
                (bet) => bet._id.toString() !== event.data._id
              ),
            ],
            cashedOut: [...context.cashedOut, cashedOutBet],
          };
        }),
        broadcastNewBet: async (context, event) => {
          logger.info("Broadcasting new bet");
          const pubsub = await getPubSub();
          pubsub.publish("crashGame", {
            crashGame: {
              crashGame: context.currentGame,
              cashedIn: context.cashedIn,
              cashedOut: context.cashedOut,
            },
          });
        },
      },
    }
  );
  return interpret(crashStateMachine, {});
};

let crashStateMachine: null | any = null;

const crash = async () => {
  if (!crashStateMachine) {
    crashStateMachine = await crashMachine();
  }

  return crashStateMachine;
};

export function getContext() {
  return crashStateMachine.state.context;
}

export default crash;
