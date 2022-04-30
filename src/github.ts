import * as github from '@actions/github';
import * as core from '@actions/core';
import { args } from './input';

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

export async function processIssues(issues: Issue[], args: args) {
  issues.forEach(async issue => {
    const timeline = await getIssueLabelTimeline(issue.number, args.token);
    // Enumerate labels in issue and check if each matches our action list
    issue.labels.forEach(label => {
      const issueLabel = typeof label === 'string' ? label : label.name;
      if (issueLabel) {
        if (args.expirationLabelMap) {
          // These are labels that we apply if an issue hasn't been updated in a specified timeframe
          args.expirationLabelMap.forEach(async lam => {
            const sourceLabelList = lam.split(':')[0].split(',');
            const configuredAction = lam.split(':')[1];
            const configuredTime = parseInt(lam.split(':')[2]);

            if (sourceLabelList.includes(issueLabel) && issueDateCompare(issue.updated_at, configuredTime)) {
              // Issue contains label specified and configured time has elapsed
              switch (configuredAction) {
                case 'add':
                  await addLabelToIssue(issue.number, lam.split(':')[3]);
                  break;
                case 'remove':
                  await removeLabelFromIssue(issue.number, lam.split(':')[3]);
                  break;
                case 'close':
                  await closeIssue(issue.number);
                  break;
                default:
                  core.error(`Unknown action ${configuredAction} for issue #${issue.number}, doing nothing`);
              }
            }
          });
        }
        if (args.updateRemoveLabels) {
          // These are labels that need removed if an issue has been updated after they were applied
          args.updateRemoveLabels.forEach(async removeMe => {
            if (Date.parse(issue.updated_at) > getIssueLabelDate(timeline, removeMe)) {
              removeLabelFromIssue(issue.number, removeMe);
            }
          });
        }
      }
    });
  });
}

async function getIssueLabelTimeline(issueNumber: number, token: string) {
  const octokit = github.getOctokit(token);
  return (
    await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber,
    })
  ).filter(event => event.event === 'labeled');
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

function issueDateCompare(issueDate: string, configuredDays: number) {
  const d = new Date(Date.parse(issueDate));
  d.setDate(d.getDate() + configuredDays);
  return d.valueOf() < Date.now();
}
