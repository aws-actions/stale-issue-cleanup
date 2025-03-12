# Changelog

## [7.1.0](https://github.com/aws-actions/stale-issue-cleanup/compare/v7.0.1...v7.1.0) (2025-03-12)


### Features

* Add dependabot auto-approve action ([f56e1ea](https://github.com/aws-actions/stale-issue-cleanup/commit/f56e1ea9446b5eea631595b5cbf5038e4bd4b8b2))


### Bug Fixes

* check failing test ([c676b23](https://github.com/aws-actions/stale-issue-cleanup/commit/c676b237a08abebcc4a33b754bcde6e010087140))

## [7.0.1](https://github.com/aws-actions/stale-issue-cleanup/compare/v7.0.0...v7.0.1) (2025-01-30)


### Miscellaneous Chores

* release 7.0.1 ([8bab335](https://github.com/aws-actions/stale-issue-cleanup/commit/8bab335c05098cfc2057d6ec3135a9942311a22e))

## 7.0.0 (2025-01-27)


### ⚠ BREAKING CHANGES

* update github dependency to latest

### Features

* add local testing options ([0a27ed0](https://github.com/aws-actions/stale-issue-cleanup/commit/0a27ed0d0700e70c5b49951148bd60017ca96f92))
* added a line to entrypoint.ts ([33662e4](https://github.com/aws-actions/stale-issue-cleanup/commit/33662e4bd9a89926fc0bd0f72807ecd61e12ab84))
* added release-please config ([c97e8f1](https://github.com/aws-actions/stale-issue-cleanup/commit/c97e8f13d4edfe6b8e4143180535766e931c1bb1))
* allow minimum upvotes to be undefined ([6162bc1](https://github.com/aws-actions/stale-issue-cleanup/commit/6162bc144766b88d8c32b034b0cf0fc2a18af2ac))
* changed operating branch ([1e50602](https://github.com/aws-actions/stale-issue-cleanup/commit/1e50602bd2fca71fc89925a34403ea71518b29ba))
* changed operating branch ([b035939](https://github.com/aws-actions/stale-issue-cleanup/commit/b035939b9bc49c8d40bcdc14734f1bdcc922c813))
* implement closed-for-staleness label ([5a70eda](https://github.com/aws-actions/stale-issue-cleanup/commit/5a70eda2e74996017f22537a25070615c05cce61))
* support debug logging ([81f4d8c](https://github.com/aws-actions/stale-issue-cleanup/commit/81f4d8ccb959a5fe43ebe8c4f025551ac888feb8))
* support dry run ([6ba614f](https://github.com/aws-actions/stale-issue-cleanup/commit/6ba614f0cb8e6da613d918ec0e8270b321ff3f2c))
* updated the version number in package.json to match the current version ([f93c871](https://github.com/aws-actions/stale-issue-cleanup/commit/f93c8717d692a74ca8b0f1f1bbc5a807e6b1687a))


### Bug Fixes

* ancient issue closing didn't work with PRs ([c6a5e2a](https://github.com/aws-actions/stale-issue-cleanup/commit/c6a5e2ab5d99b5c1a0ba674225a0564cb7ac3ef5))
* ancient issue detection broken ([ce05386](https://github.com/aws-actions/stale-issue-cleanup/commit/ce05386662538e86b67e28ac445bd9caeccca678))
* ancient tests ([5a2741d](https://github.com/aws-actions/stale-issue-cleanup/commit/5a2741d90b454a8a487eb24991f0fa9c7f5d28f0))
* broken test ([f2c45e8](https://github.com/aws-actions/stale-issue-cleanup/commit/f2c45e8fcc0b5793fd54e201121b62562d90009d))
* change label skip logic ([6bdf9c7](https://github.com/aws-actions/stale-issue-cleanup/commit/6bdf9c709f032505b35531dddfc692a954b0f192))
* check for responseRequested label before removing ([062765f](https://github.com/aws-actions/stale-issue-cleanup/commit/062765fc14fb92a3b7b710e53240ab077ab58ab8))
* docker action conversion, no more env key ([941c747](https://github.com/aws-actions/stale-issue-cleanup/commit/941c7479e67fcc0fba9680ef6186518b917aece7))
* dryrun for all runs ([bc6e83c](https://github.com/aws-actions/stale-issue-cleanup/commit/bc6e83c980720d473056233a6b1eeda6f518bf19))
* exclude third-party from automation ([f92752a](https://github.com/aws-actions/stale-issue-cleanup/commit/f92752ad52d5fe0a2a4decfb3197f851f9522b80))
* failing tests on GitHub ([046ae3a](https://github.com/aws-actions/stale-issue-cleanup/commit/046ae3a4a95c4b607280cac4f583075c7fe3acaa))
* fix broken test ([37dfa8e](https://github.com/aws-actions/stale-issue-cleanup/commit/37dfa8edd22f5fa12fc7f750c992ef2ebd88ba08))
* logging ([c9d557d](https://github.com/aws-actions/stale-issue-cleanup/commit/c9d557d95e8e7d27d64f5276f397693797e2d325))
* logging issue ([9e76f04](https://github.com/aws-actions/stale-issue-cleanup/commit/9e76f0479571f9692e4971c18ad04d2ce3b195b6))
* logging statement ([be318db](https://github.com/aws-actions/stale-issue-cleanup/commit/be318db03c42821626c64b7b62c51584aa9ae70c))
* minimum upvotes ([6029d92](https://github.com/aws-actions/stale-issue-cleanup/commit/6029d9231bc1d15c74ea8a7f6b3952173b4e50fb))
* properly next issues array ([0b41cf2](https://github.com/aws-actions/stale-issue-cleanup/commit/0b41cf2adfd592bae3c9a670592175eb862bc365))
* renamed labels break the bot ([fdc9630](https://github.com/aws-actions/stale-issue-cleanup/commit/fdc963030bd42adb290a6731bc42f7dc6a48c090)), closes [#20](https://github.com/aws-actions/stale-issue-cleanup/issues/20)
* set new tag in docs ([af0b243](https://github.com/aws-actions/stale-issue-cleanup/commit/af0b24339bd82fc3b0efd34ed0df58e65b4824ca))
* skip issues correctly ([1c718ea](https://github.com/aws-actions/stale-issue-cleanup/commit/1c718eabad4294f5c01fa5550f26b23e5a71bbe6))
* test dryrun fix ([a908afa](https://github.com/aws-actions/stale-issue-cleanup/commit/a908afa1ca428bd58a2e4ca5f47015de0dce052d))
* typo ([45668e5](https://github.com/aws-actions/stale-issue-cleanup/commit/45668e5a3366b76eca86f1e4fa1d0d9f8af1851f))
* update Dockerfile for yarn ([68e2227](https://github.com/aws-actions/stale-issue-cleanup/commit/68e2227ea9b781489faf01eb47dd595269c8e61c))
* update readme with clearer options ([91f6b86](https://github.com/aws-actions/stale-issue-cleanup/commit/91f6b864762ed412cd1e74f4860bcd8b654a03de)), closes [#13](https://github.com/aws-actions/stale-issue-cleanup/issues/13)
* update tests ([0cb2533](https://github.com/aws-actions/stale-issue-cleanup/commit/0cb2533bdb3c6d8422c471ae8c2c807860f7ded8))
* update time miscalculation ([33e723b](https://github.com/aws-actions/stale-issue-cleanup/commit/33e723bbe2699b47ce802b50bf95af4350a9148b))
* update workflow sample ([bbe5a15](https://github.com/aws-actions/stale-issue-cleanup/commit/bbe5a15935e4d033ef2d06261639a7bbf68834d1))


### Miscellaneous Chores

* release 7.0.0 ([242567a](https://github.com/aws-actions/stale-issue-cleanup/commit/242567a08e0319586680ea08e2734cd0eab1f1cd))
* release 7.0.0 ([325e501](https://github.com/aws-actions/stale-issue-cleanup/commit/325e501199d44f6d175c85b050441835888a7a06))
* update github dependency to latest ([8a25429](https://github.com/aws-actions/stale-issue-cleanup/commit/8a254290bf550a25a21f792fd4c5025ce286d3eb))
