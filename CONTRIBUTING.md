# Contributing

Thanks for getting involved and contributing to the vtshaver :tada: Below are a few things to setup when submitting a PR.

## Code comments

If adding new code, be sure to include relevant code comments. Code comments are a great way for others to learn from your code. This is especially true within the skeleton, since it is made for learning.

## Update Documentation

Be sure to update any documentation relevant to your change. This includes updating the [CHANGELOG.md](https://github.com/mapbox/vtshaver/blob/master/CHANGELOG.md).

## [Code Formatting](https://github.com/mapbox/node-cpp-skel/blob/8630d9f07f5ea78b5118c4ecb2fc2f4d310c9d72/docs/extended-tour.md#clang-tools)

We use [this script](/scripts/clang-format.sh#L20) to install a consistent version of [`clang-format`](https://clang.llvm.org/docs/ClangFormat.html) to format the code base. The format is automatically checked via a Travis CI build as well. Run the following script locally to ensure formatting is ready to merge:

    make format

We also use [`clang-tidy`](https://clang.llvm.org/extra/clang-tidy/) as a C++ linter. Run the following command to lint and ensure your code is ready to merge:

	make tidy

These commands are set from within [the Makefile](./Makefile).

## Releaseing new version

If you want release a new version of vtshaver:

- [ ] All features are landed and tickets are closed for the milestone.
- [ ] All tests are passing on travis
- [ ] Test coverage is good: same or increased
- [ ] If anything has been added to `.npmignore`, when we run `make testpacked` to ensure tests pass
- [ ] For any major new feature we've made a dev package and tested downstream in staging
- [ ] A developer has bumped the version in the `package.json` in `master`
- [ ] A developer has committed with `[publish binary]` in the commit message
- [ ] We've confirmed that the travis job with `[publish binary]` was fully 🍏
- [ ] We've tagged a new git tag `git tag v0.2.0 -a -m "vx.x.x"` and uploaded to github `git push --tags`
- [ ] Update the `changelog.md`
- [ ] Run npm pack and ensure that show only the intended files will be packaged and nothing unintended or accidental
- [ ] Publish to npm repository: `mbx npm publish`