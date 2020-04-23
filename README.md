# "Stale Issue Cleanup" Action for GitHub Actions

This GitHub action warns and then closes issues and PRs without activity
after a specified amount of time. It improves upon GitHub's original
`stale` action by allowing the action to run only on issues that contain
a specified label, and removing affecting labels once the issue sees new
activity.

## Usage

Add the following step to your workflow.

```yaml
name: "Close stale issues"
uses: aws-actions/stale-issue-cleanup@v2
with:
    stale-issue-message: Stale issue message
    stale-pr-message: Stale issue message
    ancient-issue-message: Stale issue message
    
    stale-issue-label: closing-soon
    exempt-issue-label: awaiting-approval
    stale-pr-label: no-pr-activity
    exempt-pr-label: awaiting-approval
    response-requested-label: response-requested
    closed-for-staleness-label: closed-for-staleness
    
    days-before-stale: 4,
    days-before-close: 7,
    repo-token: ${{ secrets.GITHUB_TOKEN }}
```

**NOTE:** For stability, you should use the action with either an
explicit tag, or commit SHA:

`uses: aws-actions/stale-issue-cleanup@v2` 

Check out [sample_workflow.yml](./sample_workflow.yml) for a complete
example.

## Local Testing

This action is using Docker, so you can test it locally in dry run mode if you
wish.

First, clone this repo, then:

```bash
docker build -t stale-issue-cleanup .
docker run --label stale-issue-cleanup --env-file test/local-docker.env stale-issue-cleanup
```

Check out [local-docker.env](./test/local-docker.env) to configure your local
testing options. Once you're satisfied that it's working the way you expect,
you can create a workflow file and implement this as an action on your repo.

## License Summary

This code is made available under the Apache-2.0 license.
See [LICENSE](./LICENSE).
