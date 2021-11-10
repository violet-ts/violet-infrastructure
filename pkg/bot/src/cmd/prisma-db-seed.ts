import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'prisma/db/seed',
    description: '[name=dev]; TODO: dev only',
    hidden: false,
  },
  (_env) => ({
    operation: 'prisma/db/seed',
  }),
);

export default cmd;
