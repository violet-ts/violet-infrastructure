# Violet Bot

## コマンド

- [x] help: help 表示
- [x] build: 最新のコミットをDocker コンテナのビルドと ECR への publish

- [ ] :star: preview/start, preview: 最新のコミットを専用の環境を作ってプレビュー
- [ ] :star: preview/delete: 削除スケジュールを作成 (PR closed で自動でつくる）
- [ ] preview/status: プレビュー環境のステータス
- [ ] preview/unlock: プレビュー環境のアンロック
- [ ] :star: preview/keep: preview 環境の削除スケジュールを削除
- [ ] preview/sleep: なるべく立ち上がりが速くなるように可能な限り眠らせる
- [ ] preview/awake: sleep したものの復帰

- [ ] :star: db/recreate: データベースを再生成する
- [ ] :star: db/take-snapshot: 後で使うなどの目的でスナップショットを取る
- [ ] :star: db/recreate-from `<env>/<id>`: DB を他の環境からコピーしてもってくる

- [ ] :star:  prisma/migrate: DB のマイグレーションを実行する (primsa migrate)
