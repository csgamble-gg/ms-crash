import { Document, ObjectId, ObjectID, Timestamp } from "bson";

export enum GameActions {
  Bet = "bet",
  Win = "win",
}
export interface CrashGameContext {
  currentGame: Game;
  cashedIn: Bet[];
  cashedOut: Bet[];
}

export interface BetMachineContext {
  cashedIn: Bet[];
  cashedOut: Bet[];
}

export type CrashCommandType = "CreateCrashBet" | "CashoutCrashBet";
export interface KafkaCommand {
  type: CrashCommandType;
  data: {
    sessionId: string;
    userId: string;
    amount: number;
    currency: string;
    gameId: string;
    bet: Bet;
  };
}

export interface RawCrashGame {
  _id: ObjectId;
  round: number;
  crashPoint: number;
  serverSeed: string;
  clientSeed: string;
  ended: boolean;
}

export interface KafkaConnectDocument {
  _id: {
    _data: string;
  };
  operationType: "insert" | "update" | "delete";
  clusterTime: Timestamp;
  fullDocument: Document;
  ns: { db: string; coll: string };
  documentKey: { _id: ObjectId };
}

export interface Game {
  _id: ObjectID;
  status: "created" | "started" | "finished" | "in-progress";
  crashPoint: number;
  elapsed: number;
  startsAt: Date;
  createdAt: Date;
  gameType: string;
  gameId: string;
  multiplier: number;
  rawGameId: ObjectID;
  secrets: {
    serverSeed: string;
    // serverSeedHash: string;
    clientSeed: string;
  };
}

export interface GameAction {
  _id: ObjectID | string;
  gameId: string;
  currency: string;
  game: string;
  action: "bet" | "win" | "rollback";
  amount: number;
  createdAt: Date;
  // rtp: string;
  originalBetId: ObjectID;
  payoutMultiplier?: number;
  user: {
    _id: ObjectID;
    steamId: string;
    displayName: string;
    avatar: string;
  };
  sessionId?: string;
}

export type User = {
  _id: string;
  avatar?: string;
  balance: number;
  createdAt: string;
  displayName: string;
  steamID: string;
  wallets: Wallet[];
};

export type Wallet = {
  type: string;
  balance: number;
  address: number;
};

export type Bet = {
  _id: string;
  amount: number;
  gameId: string;
  user: User;
};

export type RouletteBets = {
  blue: Array<Bet>;
  orange: Array<Bet>;
  purple: Array<Bet>;
};

export type RouletteEvent = { type: "BET_CREATED"; data: GameAction };
