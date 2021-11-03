import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'prisma/migrate/reset',
    where: 'pr',
    description: '先に /preview/start が必要',
    hidden: false,
  },
  (_env) => ({
    operation: 'prisma/migrate/reset',
  }),
);

export default cmd;
