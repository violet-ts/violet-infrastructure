import { initApp } from '@portal/api/src/app/init-app';

const app = initApp();

const port = 3040;

// eslint-disable-next-line no-console
console.log(`listening on [::]:${port}`);
app.listen(port);
