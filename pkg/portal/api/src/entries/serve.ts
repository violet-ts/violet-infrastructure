require('source-map-support').install();
require('dotenv').config({
  path: require('path').resolve(__dirname, '..', '..', '..', '..', '.env.local') as string,
});
require('../app/serve');
