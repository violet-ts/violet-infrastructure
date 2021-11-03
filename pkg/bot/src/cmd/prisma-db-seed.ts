import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'prisma/db/seed',
    where: 'pr',
    description: '先に /preview/start が必要',
    hidden: false,
  },
  (_env) => ({
    operation: 'prisma/db/seed',
  }),
);

export default cmd;
