import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'prisma/migrate/deploy',
    where: 'pr',
    description: '先に /preview/start が必要',
    hidden: false,
  },
  (_env) => ({
    operation: 'prisma/migrate/deploy',
  }),
);

export default cmd;
