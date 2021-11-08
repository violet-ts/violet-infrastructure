import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'prisma/db/seed',
    description: '',
    hidden: false,
  },
  (_env) => ({
    operation: 'prisma/db/seed',
  }),
);

export default cmd;
