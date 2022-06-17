import crypto from "crypto";
import { ObjectID } from "mongodb";
import getDb from "./src/lib/getDb";

function genGameHash(serverSeed: any) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

function crashPointFromHash(serverSeed: any, clientSeed: any) {
  function divisible(hash: any, mod: any) {
    // We will read in 4 hex at a time, but the first chunk might be a bit smaller
    // So ABCDEFGHIJ should be chunked like  AB CDEF GHIJ
    var val = 0;

    var o = hash.length % 4;
    for (var i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
      val = ((val << 16) + parseInt(hash.substring(i, i + 4), 16)) % mod;
    }

    return val === 0;
  }

  var hash = crypto
    .createHmac("sha256", serverSeed)
    .update(clientSeed)
    .digest("hex");

  const HOUSE_EDGE = 5;

  // @ts-ignore
  const hs = parseInt(100 / HOUSE_EDGE);

  /* In 1 of 101 games the game crashes instantly. */
  if (divisible(hash, hs)) {
    crashedCount++;
    return 1;
  }

  /* Use the most significant 52-bit from the hash
       to calculate the crash point */
  var h = parseInt(hash.slice(0, 52 / 4), 16);
  var e = Math.pow(2, 52);

  return Math.floor((100 * e - h) / (e - h)) / 100.0;
}

let crashedCount = 0;
let totalProcessed = 0;
async function start() {
  var serverSecret = "If you knew this, you could steal all my money";
  var clientSeed =
    "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c";

  var gamesToGenerate = 1e7;

  var serverSeed = serverSecret;

  let rounds: any[] = [];

  for (var game = gamesToGenerate; game > 0; --game) {
    serverSeed = genGameHash(serverSeed);
    totalProcessed++;
    const crashPoint = crashPointFromHash(serverSeed, clientSeed);
    console.log(
      "Game " + game + " has a crash point of " + crashPoint.toFixed(2) + "x",
      "\t\tHash: " +
        serverSeed +
        "\t\t" +
        "House Edge: % " +
        crashedCount / totalProcessed +
        "\t\t" +
        "Crashed Count: " +
        crashedCount +
        "/" +
        totalProcessed
    );

    const round = {
      _id: new ObjectID(),
      round: game,
      crashPoint: Math.round(crashPoint * 100),
      serverSeed,
      clientSeed,
      ended: false,
    };

    rounds.push(round);

    if (rounds.length > 2000) {
      const db = await getDb();
      // await db.collection("crash-games").insertMany(rounds);
      rounds = [];
    }
  }

  var terminatingHash = genGameHash(serverSeed);

  console.log("The terminating hash is: ", terminatingHash);
}

start().catch((e) => console.log(e.message));
