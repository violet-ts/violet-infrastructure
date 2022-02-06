## TODO: terraformと連携させてアップロードするようにする

cd pkg/portal/web
pnpm run compile
cd out
aws --profile violet s3 sync --delete --acl 'public-read' . s3://portal.a.violet-dev.com

