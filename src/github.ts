import * as github from '@actions/github';
import * as core from '@actions/core';
import { args } from './input.js';

export const labelActions = ['add', 'remove', 'close'] as const;

type Element<T extends unknown[]> = T extends readonly (infer ElementType)[] ? ElementType : never;
export type Issue = Element<Awaited<ReturnType<typeof getIssues>>>;
export type Timeline = Awaited<ReturnType<typeof getIssueLabelTimeline>>;

export async function getIssues(labels: string[], token: string) {
  const octokit = github.getOctokit(token);
  return await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    state: 'open',
    labels: labels.join(),
  });
}

// Issue processing steps
// Step 1: Skip closed/merged/locked
// Step 2: If the issue is a PR, use the PR configuration, else use the issue configuration
// Step 3: Iterate all labels in the issue. If labeled, iterate over the configured labels and see if the issue's labels
//         match the configured ones.
// Step 4: If they do, take the action specified in the configuration line, and repeat for all configuration lines
// Step 5: Do step 4 but for the updateRemoveLabels
export async function processIssues(issues: Issue[], args: args) {
  await Promise.all(
    issues.map(async issue => {
      // Skip closed and locked issues
      if (issue.state === 'closed' || issue.state === 'merged' || issue.locked) return;

      const timeline = await getIssueLabelTimeline(issue.number, args.token);
      const expirationLabelMap = isPr(issue) ? args.prExpirationLabelMap : args.expirationLabelMap;
      const removeLabelMap = isPr(issue) ? args.prUpdateRemoveLabels : args.updateRemoveLabels;
      // Enumerate labels in issue and check if each matches our action list
      await Promise.all(
        issue.labels.map(async label => {
          const issueLabel = typeof label === 'string' ? label : label.name;
          if (issueLabel) {
            if (expirationLabelMap) {
              // These are labels that we apply if an issue hasn't been updated in a specified timeframe
              await Promise.all(
                expirationLabelMap.map(async lam => {
                  const sourceLabelList = lam.split(':')[0].split(',');
                  const configuredAction = lam.split(':')[1];
                  const configuredTime = parseInt(lam.split(':')[2]);

                  if (sourceLabelList.includes(issueLabel) && issueDateCompare(issue.updated_at, configuredTime)) {
                    // Issue contains label specified and configured time has elapsed
                    switch (configuredAction) {
                      case 'add':
                        await addLabelToIssue(issue.number, [lam.split(':')[3]], args.token);
                        break;
                      case 'remove':
                        await removeLabelFromIssue(issue.number, [lam.split(':')[3]], args.token);
                        break;
                      case 'close':
                        await closeIssue(issue.number, args.token);
                        break;
                      default:
                        core.error(`Unknown action ${configuredAction} for issue #${issue.number}, doing nothing`);
                    }
                  }
                })
              );
            }
            if (removeLabelMap) {
              // These are labels that need removed if an issue has been updated after they were applied
              const labelsToRemove: string[] = [];
              removeLabelMap.forEach(removeMe => {
                if (Date.parse(issue.updated_at) > getIssueLabelDate(timeline, removeMe)) {
                  labelsToRemove.push(removeMe);
                }
              });
              await removeLabelFromIssue(issue.number, labelsToRemove, args.token);
            }
          }
        })
      );
    })
  );
}

export async function getIssueLabelTimeline(issueNumber: number, token: string) {
  const octokit = github.getOctokit(token);
  return (
    await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber,
    })
  ).filter(event => event.event === 'labeled');
}

export async function addLabelToIssue(issue: number, labels: string[], token: string) {
  const octokit = github.getOctokit(token);
  return await octokit.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue,
    labels,
  });
}

export async function removeLabelFromIssue(issue: number, label: string[], token: string) {
  const octokit = github.getOctokit(token);
  return await Promise.all(
    label.map(async label => {
      return await octokit.rest.issues.removeLabel({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: issue,
        name: label,
      });
    })
  );
}

export async function closeIssue(issue: number, token: string) {
  const octokit = github.getOctokit(token);
  return await octokit.rest.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue,
    state: 'closed',
  });
}

export async function reopenIssue(issue: number, token: string) {
  const octokit = github.getOctokit(token);
  return await octokit.rest.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue,
    state: 'open',
  });
}

function getIssueLabelDate(timeline: Timeline, label: string) {
  // Return when the label was last applied
  return timeline.reduce((p, c) => {
    if (c.updated_at && c.label?.name === label) {
      if (Date.parse(c.updated_at) > p) {
        return Date.parse(c.updated_at);
      } else {
        return p;
      }
    } else {
      return p;
    }
  }, 0);
}

export function issueDateCompare(issueDate: string, configuredDays: number) {
  const d = new Date(Date.parse(issueDate));
  d.setDate(d.getDate() + configuredDays);
  return d.valueOf() < Date.now();
}

export function isPr(issue: Issue) {
  return !!issue.pull_request;
}
