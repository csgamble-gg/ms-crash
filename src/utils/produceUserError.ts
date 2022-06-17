import getPubSub from "../lib/getPubSub";

const produceUserError = async (sessionId: string, message: string) => {
  const pubsub = await getPubSub();

  await pubsub.publish("userError", {
    userError: {
      sessionId,
      message,
    },
  });
};

export default produceUserError;
