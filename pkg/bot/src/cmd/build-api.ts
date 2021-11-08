import createCmd from './template/build-container';

const cmd = createCmd(
  {
    name: 'build/api',
    description: 'API イメージをビルド',
    hidden: false,
  },
  (env) => ({
    imageRepoName: env.API_REPO_NAME,
    buildDockerfile: './docker/api/Dockerfile',
    projectName: env.API_BUILD_PROJECT_NAME,
    dockerBuildArgs: '',
  }),
);
export default cmd;
