import * as core from '@actions/core';
import * as github from '@actions/github';
import { closeIssue, getIssues, getTimelineEvents, hasEnoughUpvotes, markStale, removeLabel } from './github';
import {
  dateFormatToIsoUtc,
  getLastCommentTime,
  getLastLabelTime,
  isLabeled,
  parseCommaSeparatedString,
} from './utils';

const MS_PER_DAY = 86400000;

export type Inputs = {
  repoToken: string;
  ancientIssueMessage: string;
  ancientPrMessage: string;
  staleIssueMessage: string;
  stalePrMessage: string;
  daysBeforeStale: number;
  daysBeforeClose: number;
  daysBeforeAncient: number;
  staleIssueLabel: string;
  exemptIssueLabels: string;
  stalePrLabel: string;
  exemptPrLabels: string;
  cfsLabel: string;
  issueTypes: string[];
  responseRequestedLabel: string;
  minimumUpvotesToExempt: number;
  dryrun: boolean;
  useCreatedDateForAncient: boolean;
};

export function getAndValidateInputs(): Inputs {
  const args = {
    repoToken: process.env.REPO_TOKEN ?? '',
    ancientIssueMessage: process.env.ANCIENT_ISSUE_MESSAGE ?? '',
    ancientPrMessage: process.env.ANCIENT_PR_MESSAGE ?? '',
    staleIssueMessage: process.env.STALE_ISSUE_MESSAGE ?? '',
    stalePrMessage: process.env.STALE_PR_MESSAGE ?? '',
    daysBeforeStale: Number.parseFloat(process.env.DAYS_BEFORE_STALE ?? '0'),
    daysBeforeClose: Number.parseFloat(process.env.DAYS_BEFORE_CLOSE ?? '0'),
    daysBeforeAncient: Number.parseFloat(process.env.DAYS_BEFORE_ANCIENT ?? '0'),
    staleIssueLabel: process.env.STALE_ISSUE_LABEL ?? '',
    exemptIssueLabels: process.env.EXEMPT_ISSUE_LABELS ?? '',
    stalePrLabel: process.env.STALE_PR_LABEL ?? '',
    exemptPrLabels: process.env.EXEMPT_PR_LABELS ?? '',
    cfsLabel: process.env.CFS_LABEL ?? '',
    issueTypes: (process.env.ISSUE_TYPES ?? '').split(','),
    responseRequestedLabel: process.env.RESPONSE_REQUESTED_LABEL ?? '',
    minimumUpvotesToExempt: Number.parseInt(process.env.MINIMUM_UPVOTES_TO_EXEMPT ?? '0'),
    dryrun: String(process.env.DRYRUN).toLowerCase() === 'true',
    useCreatedDateForAncient: String(process.env.USE_CREATED_DATE_FOR_ANCIENT).toLowerCase() === 'true',
  } satisfies Inputs;

  for (const numberInput of [args.daysBeforeAncient, args.daysBeforeClose, args.daysBeforeStale]) {
    if (Number.isNaN(numberInput)) {
      throw Error(`input ${numberInput} did not parse to a valid integer`);
    }
  }

  return args;
}

async function processIssues(client: github.GitHub, args: Inputs) {
  const uniqueIssues = await getIssues(client, args);

  for await (const _ of uniqueIssues.map(async (issue) => {
    core.debug('==================================================');
    core.debug(`ISSUE #${issue.number}: ${issue.title}`);
    core.debug(`last updated ${issue.updated_at}`);
    const isPr = 'pull_request' in issue;
    const skipPullRequests = args.issueTypes.indexOf('pull_requests') === -1;
    const skipIssues = args.issueTypes.indexOf('issues') === -1;

    if (isPr && skipPullRequests) {
      // If record is a pull request but pull requests weren't configured
      core.debug('Issue is a pull request, which are excluded');
      return;
    }

    if (!isPr && skipIssues) {
      // If record is an issue but issues weren't configured
      core.debug('Issue is an issue, which are excluded');
      return;
    }


    const staleMessage = isPr ? args.stalePrMessage : args.staleIssueMessage;
    const ancientMessage = isPr ? args.ancientPrMessage : args.ancientIssueMessage;

    const staleLabel = isPr ? args.stalePrLabel : args.staleIssueLabel;
    const exemptLabels = parseCommaSeparatedString(isPr ? args.exemptPrLabels : args.exemptIssueLabels);
    const responseRequestedLabel = isPr ? args.responseRequestedLabel : args.responseRequestedLabel;
    core.debug('Trying to get timeline events ');

    const issueTimelineEvents = await getTimelineEvents(client, issue);
    core.debug('I got the timeline events!');

    const currentTime = new Date(Date.now());

    if (exemptLabels?.some((s) => isLabeled(issue, s))) {
      // If issue contains exempt label, do nothing
      core.debug('issue contains exempt label');
      return;
    }


    if (isLabeled(issue, staleLabel)) {
      core.debug('issue contains the stale label');

      const commentTime = getLastCommentTime(issueTimelineEvents);
      const lastCommentTime = commentTime ? commentTime.getTime() : 0;

      const staleLabelTime = getLastLabelTime(issueTimelineEvents, staleLabel)?.getTime();
      const sTime = new Date(lastCommentTime + MS_PER_DAY * args.daysBeforeClose);

      // This happens when we can't determine the time of labeling stale
      // but GitHub told us it has a stale label on it.
      if (staleLabelTime === undefined) {
        core.warning('Skipping this issue');
        return;
      }

      if (lastCommentTime > staleLabelTime) {
        core.debug('issue was commented on after the label was applied');
        if (args.dryrun) {
          core.info(`dry run: would remove ${staleLabel} and ${responseRequestedLabel} labels for #${issue.number}`);
        } else {
          await removeLabel(client, issue, staleLabel);
          if (isLabeled(issue, responseRequestedLabel)) {
            await removeLabel(client, issue, responseRequestedLabel);
          }
        }
      } else {
        if (currentTime > sTime) {
          core.debug('time expired on this issue, need to close it');
          if (args.dryrun) {
            core.info(`dry run: would remove ${staleLabel} for #${issue.number} and close`);
          } else {
            await removeLabel(client, issue, staleLabel);
            await closeIssue(client, issue, args.cfsLabel);
          }
        } else {
          // else ignore it because we need to wait longer before closing
          core.debug(`${dateFormatToIsoUtc(currentTime)} is less than ${dateFormatToIsoUtc(sTime)}, doing nothing`);
        }
      }
    } else if (isLabeled(issue, responseRequestedLabel)) {
      // const lastCommentTime = getLastCommentTime(issueTimelineEvents);
      const commentTime = getLastCommentTime(issueTimelineEvents);
      const lastCommentTime = commentTime ? commentTime.getTime() : 0;

      const rrLabelTime = getLastLabelTime(issueTimelineEvents, responseRequestedLabel);
      const rrLabelTimeMilliseconds = rrLabelTime ? rrLabelTime.getTime() : 0;

      const rrTime = new Date(lastCommentTime + MS_PER_DAY * args.daysBeforeStale);
      if (lastCommentTime > rrLabelTimeMilliseconds) {
        core.debug('issue was commented on after the label was applied');
        if (args.dryrun) {
          core.info(`dry run: would remove ${responseRequestedLabel} from #${issue.number}`);
        } else {
          await removeLabel(client, issue, responseRequestedLabel);
        }
      } else {
        if (currentTime >= rrTime) {
          if (staleMessage) {
            core.debug('time expired on this issue, need to label it stale');
            if (args.dryrun) {
              core.info(`dry run: would mark #${issue.number} as ${staleLabel} due to ${responseRequestedLabel} age`);
            } else {
              await markStale(client, issue, staleMessage, staleLabel);
            }
          } else {
            core.debug('stale message is null/empty, doing nothing');
          }
        } else {
          // else ignore it because we need to wait longer before staleing
          core.debug('issue is not stale yet');
          core.debug(`${dateFormatToIsoUtc(currentTime)} is less than ${dateFormatToIsoUtc(rrTime)}, doing nothing`);
        }
      }
    } else {
      core.debug('asdasdkasf');
      const dateToCompare = args.useCreatedDateForAncient ? Date.parse(issue.created_at) : Date.parse(issue.updated_at);
      core.debug(
        `using issue ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} to determine if the issue is ancient.`,
      );
      if (dateToCompare < new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient).getTime()) {
        if (typeof args.minimumUpvotesToExempt !== 'undefined') {
          if (await hasEnoughUpvotes(client, issue.number, args.minimumUpvotesToExempt)) {
            core.debug('issue is ancient but has enough upvotes to exempt');
          } else {
            core.debug('issue is ancient and not enough upvotes; marking stale');
            if (ancientMessage) {
              if (args.dryrun) {
                core.info(
                  `dry run: would mark #${issue.number} as ${staleLabel} due to ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} age`,
                );
              } else {
                await markStale(client, issue, ancientMessage, staleLabel);
              }
            } else {
              core.debug('ancient message is null/empty, doing nothing');
            }
          }
        } else {
          core.debug('issue is ancient and not enough upvotes; marking stale');
          if (ancientMessage) {
            if (args.dryrun) {
              core.info(
                `dry run: would mark #${issue.number} as ${staleLabel} due to ${args.useCreatedDateForAncient ? 'created date' : 'last updated'} age`,
              );
            } else {
              await markStale(client, issue, ancientMessage, staleLabel);
            }
          } else {
            core.debug('ancient message is null/empty, doing nothing');
          }
        }
      }
    }
  }));
}

export async function run(): Promise<void> {
  try {
    core.info('Starting issue processing');
    const args = getAndValidateInputs();
    core.debug(JSON.stringify(args, null, 2));
    const client = new github.GitHub({ auth: args.repoToken, userAgent: 'GHA Stale Issue' });
    await processIssues(client, args);
    core.info('Labelled issue processing complete');
    process.exitCode = 0;
  } catch (e) {
    core.error(`failed to run action: ${e}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}
