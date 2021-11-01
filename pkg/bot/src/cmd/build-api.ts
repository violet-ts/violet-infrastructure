import createCmd from './template/build-container';

const cmd = createCmd('build/api', (env) => ({
  imageRepoName: env.API_REPO_NAME,
  buildDockerfile: './docker/api/Dockerfile',
  projectName: env.API_BUILD_PROJECT_NAME,
}));
export default cmd;
