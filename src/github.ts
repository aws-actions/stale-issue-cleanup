import * as github from '@actions/github';

export async function getIssues(labels: string[], token: string) {
  const octokit = github.getOctokit(token);
  return await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: 'open',
    labels: labels.join(),
  });
}
