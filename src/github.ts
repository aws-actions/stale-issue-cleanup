import * as core from '@actions/core';
import * as github from '@actions/github';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { Inputs } from './entrypoint';
import type { issueTimelineEventsType, issueType } from './utils';

const MS_PER_DAY = 86400000;

type IssueResponse = RestEndpointMethodTypes['issues']['listForRepo']['response']['data'][number];

export async function closeIssue(client: ReturnType<typeof github.getOctokit>, issue: issueType, cfsLabel: string) {
  core.debug(`closing issue #${issue.number} for staleness`);
  if (cfsLabel && cfsLabel !== '') {
    await client.rest.issues.addLabels({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issue.number,
      labels: [cfsLabel],
    });
  }
  await client.rest.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    state: 'closed',
  });
}

export async function removeLabel(client: ReturnType<typeof github.getOctokit>, issue: issueType, label: string) {
  core.debug(`removing label ${label} from issue #${issue.number}`);
  await client.rest.issues.removeLabel({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    name: label,
  });
}

export async function markStale(
  client: ReturnType<typeof github.getOctokit>,
  issue: issueType,
  staleMessage: string,
  staleLabel: string,
) {
  core.debug(`marking issue #${issue.number} as stale`);
  await client.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    body: staleMessage,
  });
  await client.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.number,
    labels: [staleLabel],
  });
}

export async function getTimelineEvents(
  client: ReturnType<typeof github.getOctokit>,
  issue: issueType,
): Promise<issueTimelineEventsType[]> {
  return client.paginate(client.rest.issues.listEventsForTimeline, {
    issue_number: issue.number,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    per_page: 100,
  });
}

export async function getIssues(
  client: ReturnType<typeof github.getOctokit>,
  args: Inputs,
): Promise<Array<IssueResponse>> {
  let responseIssues: IssueResponse[] = [];
  let staleIssues: IssueResponse[] = [];
  let stalePrs: IssueResponse[] = [];
  let ancientIssues: IssueResponse[] = [];

  responseIssues = await client.paginate(client.rest.issues.listForRepo, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: 'open',
    labels: args.responseRequestedLabel,
    per_page: 100,
  });
  core.debug(`found ${responseIssues.length} response-requested issues`);

  if (args.staleIssueMessage && args.staleIssueMessage !== '') {
    staleIssues = await client.paginate(client.rest.issues.listForRepo, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      labels: args.staleIssueLabel,
      per_page: 100,
    });
    core.debug(`found ${staleIssues.length} stale issues`);
  } else {
    core.debug('skipping stale issues due to empty message');
  }

  if (args.stalePrMessage && args.stalePrMessage !== '') {
    stalePrs = await client.paginate(client.rest.issues.listForRepo, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      labels: args.stalePrLabel,
      per_page: 100,
    });
    core.debug(`found ${stalePrs.length} stale PRs`);
  } else {
    core.debug('skipping stale PRs due to empty message');
  }

  if (args.ancientIssueMessage && args.ancientIssueMessage !== '') {
    core.debug(
      `using issue ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} to determine for getting ancient issues.`,
    );

    const ancientResults = await client.paginate(client.rest.issues.listForRepo, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      per_page: 100,
      sort: 'updated',
      direction: 'asc',
    });

    ancientIssues = ancientResults.filter(
      (issue) =>
        (args.useCreatedDateForAncient ? new Date(issue.created_at) : new Date(issue.updated_at)) <
        new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient),
    );
    core.debug(`found ${ancientIssues.length} ancient issues`);
  } else {
    core.debug('skipping ancient issues due to empty message');
  }

  const issues = [...responseIssues, ...staleIssues, ...stalePrs, ...ancientIssues];
  return Object.values(
    issues.reduce<Record<string, IssueResponse>>((unique, item) => {
      unique[`${item.id}`] = item;
      return unique;
    }, {}),
  );
}

export async function hasEnoughUpvotes(
  // client: github.GitHub,
  client: ReturnType<typeof github.getOctokit>,
  issueNumber: number,
  upvoteCount: number,
): Promise<boolean> {
  const reactions = await client.paginate(client.rest.reactions.listForIssue, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issueNumber,
    // The squirrel-girl preview is no longer needed in newer versions
    per_page: 100,
  });

  if (reactions && reactions.length > 0) {
    const upvotes = reactions.reduce((acc: number, cur: { content: string }) => {
      if (cur.content === '+1' || cur.content === 'heart' || cur.content === 'hooray' || cur.content === 'rocket') {
        return acc + 1;
      }
      return acc;
    }, 0);
    return upvotes >= upvoteCount;
  }
  return false;
}
