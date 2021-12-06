import createCmd from './template/operate-env';

const cmd = createCmd(
  {
    name: 'lighthouse',
    description: '[url=] [...]',
    hidden: false,
  },
  (_env) => ({
    operation: 'lighthouse',
  }),
);

export default cmd;
