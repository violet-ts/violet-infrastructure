import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'prisma/migrate/deploy',
    description: '',
    hidden: false,
  },
  (_env) => ({
    operation: 'prisma/migrate/deploy',
  }),
);

export default cmd;
