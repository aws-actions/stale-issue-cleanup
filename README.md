# "Stale Issue Cleanup" Action for GitHub Actions

This GitHub action warns and then closes issues and PRs without activity
after a specified amount of time. It improves upon [GitHub's original
stale action](https://github.com/actions/stale) by allowing the action 
to run only on issues that contain a specified label, and removing labels
once the issue sees new activity.

## Building and testing

Install dependencies
```bash
$ yarn install
```

Run unit tests
```bash
$ yarn test
```

### Local Integ Testing with Docker

This action is using Docker, so you can test it locally in dry run mode if you
wish.

```bash
$ docker build -t stale-issue-cleanup .
$ docker run --label stale-issue-cleanup --env-file test/local-docker.env stale-issue-cleanup
```

Check out [local-docker.env](./test/local-docker.env) to configure your local
testing options. Once you're satisfied that it's working the way you expect,
you can create a workflow file and implement this as an action on your repo.


## Usage

You need to add a workflow file into your repository under
[.github/workflows](./.github/workflows), just like any other Github Action.
This workflow file [follows the standard workflow syntax for Github Actions.](https://help.github.com/en/actions/reference/workflow-syntax-for-github-actions).

A sample workflow file for you to use as a drop-in is in [sample_workflow.yml](./sample_workflow.yml).

For a list of options and their description, see [action.yml](./action.yml).

Here's an abbreviated example with just the step for this action:

```yaml
steps:
- uses: aws-actions/stale-issue-cleanup@v3
  with:
    # Types of issues that will be processed
    issue-types: issues,pull_requests

    # Messages this action will apply to issues
    stale-issue-message: Stale issue message
    stale-pr-message: Stale pr message
    ancient-issue-message: Ancient issue message
    ancient-pr-message: Ancient pr message


    # Labels this action will apply to issues
    stale-issue-label: closing-soon
    exempt-issue-labels: awaiting-approval
    stale-pr-label: no-pr-activity
    exempt-pr-labels: awaiting-approval
    response-requested-label: response-requested
    closed-for-staleness-label: closed-for-staleness

    # Issue timing and upvote counting
    days-before-stale: 4
    days-before-close: 7
    days-before-ancient: 365
    minimum-upvotes-to-exempt: 10

    # Testing/debugging options
    loglevel: DEBUG
    dry-run: true

    # Leave this alone, or set to a PAT for the action to use
    repo-token: ${{ secrets.GITHUB_TOKEN }}
```

**NOTE:** For stability, you should use the action with either an
explicit tag, or commit SHA:

`uses: aws-actions/stale-issue-cleanup@v3` 

## License Summary

This code is made available under the Apache-2.0 license.
See [LICENSE](./LICENSE).
