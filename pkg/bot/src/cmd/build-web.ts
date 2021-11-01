import createCmd from './template/build-container';

const cmd = createCmd('build/web', (env) => ({
  imageRepoName: env.WEB_REPO_NAME,
  buildDockerfile: './docker/web/Dockerfile',
  projectName: env.WEB_BUILD_PROJECT_NAME,
}));
export default cmd;
