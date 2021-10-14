exports.handler = async function handler(event, context) {
  // eslint-disable-next-line no-console
  console.log(`EVENT: \n${JSON.stringify(event, null, 2)}`);
  return context.logStreamName;
};
