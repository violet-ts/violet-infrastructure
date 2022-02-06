const withTM = require('next-transpile-modules')(['@portal/api']);

/** @type {import('next').NextConfig} */
module.exports = withTM({
  reactStrictMode: true,
  pageExtensions: ['page.tsx'],
  trailingSlash: true,
});
