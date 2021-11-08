import createCmd from './template/build-container';

const cmd = createCmd(
  {
    name: 'build/lambda/apiexec',
    description: 'Lambda for apiexec イメージをビルド',
    hidden: false,
  },
  (env) => ({
    imageRepoName: env.LAMBDA_APIEXEC_REPO_NAME,
    buildDockerfile: './docker/lambda/apiexec/Dockerfile',
    projectName: env.LAMBDA_APIEXEC_BUILD_PROJECT_NAME,
    dockerBuildArgs: '',
  }),
);
export default cmd;
