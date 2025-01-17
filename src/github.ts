import * as core from '@actions/core';
import * as github from '@actions/github';
import type { Inputs } from './entrypoint';
import type { issueTimelineEventsType, issueType } from './utils';

const MS_PER_DAY = 86400000;

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

export async function getIssues(client: ReturnType<typeof github.getOctokit>, args: Inputs): Promise<Array<issueType>> {
  const responseIssues: issueType[] = await client.paginate(client.rest.issues.listForRepo, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: 'open',
    labels: args.responseRequestedLabel,
    per_page: 100,
  });
  core.debug(`found ${responseIssues.length} response-requested issues`);

  const staleIssues: issueType[] = [];
  if (args.staleIssueMessage && args.staleIssueMessage !== '') {
    staleIssues.push(
      ...(await client.paginate(client.rest.issues.listForRepo, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        state: 'open',
        labels: args.staleIssueLabel,
        per_page: 100,
      })),
    );
    core.debug(`found ${staleIssues.length} stale issues`);
  } else {
    core.debug('skipping stale issues due to empty message');
  }

  const stalePrs: issueType[] = [];
  if (args.stalePrMessage && args.stalePrMessage !== '') {
    stalePrs.push(
      ...(await client.paginate(client.rest.issues.listForRepo, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        state: 'open',
        labels: args.stalePrLabel,
        per_page: 100,
      })),
    );
    core.debug(`found ${stalePrs.length} stale PRs`);
  } else {
    core.debug('skipping stale PRs due to empty message');
  }

  const ancientIssues: issueType[] = [];
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
    ancientResults
      .filter(
        (issue) =>
          (args.useCreatedDateForAncient ? new Date(issue.created_at) : new Date(issue.updated_at)) <
          new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient),
      )
      .map((i) => ancientIssues.push(i));
    core.debug(`found ${ancientIssues.length} ancient issues`);
  } else {
    core.debug('skipping ancient issues due to empty message');
  }

  const issues = [...responseIssues, ...staleIssues, ...stalePrs, ...ancientIssues];
  // Dedupe issues based on id
  const ids = new Set();
  return issues.filter((issue) => (ids.has(issue.id) ? false : ids.add(issue.id)));
}

export async function hasEnoughUpvotes(
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
  const upvotes = reactions.reduce((acc, cur) => (cur.content.match(/\+1|heart|hooray|rocket/) ? acc + 1 : acc), 0);
  return upvotes >= upvoteCount;
}
