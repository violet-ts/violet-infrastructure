import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'prisma/migrate/reset',
    description: '',
    hidden: false,
  },
  (_env) => ({
    operation: 'prisma/migrate/reset',
  }),
);

export default cmd;
