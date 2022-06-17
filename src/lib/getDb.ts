import { Db, MongoClient } from "mongodb";

let mongoClient: MongoClient | undefined;

export default async function getDb(): Promise<Db> {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGO_URI as string);
    await mongoClient.connect();
  }
  return mongoClient.db("csgamble");
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGO_URI as string);
    await mongoClient.connect();
  }
  return mongoClient;
}
