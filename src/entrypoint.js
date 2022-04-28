const { logSetup } = require('./logsetup.js');
logSetup();
const log = require('loglevel').getLogger('main');
const github = require('@actions/github');
const {
  closeIssue,
  removeLabel,
  markStale,
  getTimelineEvents,
  getIssues,
  hasEnoughUpvotes,
} = require('./github.js');
const {
  isLabeled,
  getLastLabelTime,
  getLastCommentTime,
  asyncForEach,
  dateFormatToIsoUtc,
  parseCommaSeparatedString,
} = require('./utils.js');

const MS_PER_DAY = 86400000;

/**
 * Function to populate args array with docker inputs
 * @return {object} Dictionary of action inputs
 */
function getAndValidateInputs() {
  const args = {
    repoToken: process.env.REPO_TOKEN,
    ancientIssueMessage: process.env.ANCIENT_ISSUE_MESSAGE,
    ancientPrMessage: process.env.ANCIENT_PR_MESSAGE,
    staleIssueMessage: process.env.STALE_ISSUE_MESSAGE,
    stalePrMessage: process.env.STALE_PR_MESSAGE,
    daysBeforeStale: parseFloat(process.env.DAYS_BEFORE_STALE),
    daysBeforeClose: parseFloat(process.env.DAYS_BEFORE_CLOSE),
    daysBeforeAncient: parseFloat(process.env.DAYS_BEFORE_ANCIENT),
    staleIssueLabel: process.env.STALE_ISSUE_LABEL,
    exemptIssueLabels: process.env.EXEMPT_ISSUE_LABELS,
    requiredIssueLabels: process.env.REQUIRED_ISSUE_LABELS,
    stalePrLabel: process.env.STALE_PR_LABEL,
    exemptPrLabels: process.env.EXEMPT_PR_LABELS,
    requiredPrLabels: process.env.REQUIRED_PR_LABELS,
    cfsLabel: process.env.CFS_LABEL,
    issueTypes: process.env.ISSUE_TYPES.split(','),
    responseRequestedLabel: process.env.RESPONSE_REQUESTED_LABEL,
    minimumUpvotesToExempt: parseInt(process.env.MINIMUM_UPVOTES_TO_EXEMPT),
    dryrun: String(process.env.DRYRUN).toLowerCase() === 'true',
  };

  for (const numberInput of [
    args.daysBeforeAncient,
    args.daysBeforeClose,
    args.daysBeforeStale,
  ]) {
    if (isNaN(numberInput)) {
      throw Error(`input ${numberInput} did not parse to a valid integer`);
    }
  }

  return args;
}

/**
 * Process the open issues in repo
 * @param {github.GitHub} client
 * @param {Args} args
 * @param {number} operationsLeft
 * @param {number} page
 */
async function processIssues(client, args) {
  const uniqueIssues = await getIssues(client, args);

  await asyncForEach(uniqueIssues, async (issue) => {
    log.debug(`==================================================`);
    log.debug(`ISSUE #${issue.number}: ${issue.title}`);
    log.debug(`last updated ${issue.updated_at}`);
    const isPr = 'pull_request' in issue ? true : false;
    const skipPullRequests = args.issueTypes.indexOf(`pull_requests`) == -1;
    const skipIssues = args.issueTypes.indexOf(`issues`) == -1;

    if (isPr && skipPullRequests) {
      // If record is a pull request but pull requests weren't configured
      log.debug(`Issue is a pull request, which are excluded`);
      return;
    }

    if (!isPr && skipIssues) {
      // If record is an issue but issues weren't configured
      log.debug(`Issue is an issue, which are excluded`);
      return;
    }

    const staleMessage = isPr ? args.stalePrMessage : args.staleIssueMessage;
    /*
    const ancientMessage = isPr
      ? args.ancientPrMessage
      : args.ancientIssueMessage;
    */
    const ancientMessage = isPr ? args.ancientPrMessage : args.ancientIssueMessage;

    const staleLabel = isPr ? args.stalePrLabel : args.staleIssueLabel;
    const exemptLabels = parseCommaSeparatedString(
      isPr ? args.exemptPrLabels : args.exemptIssueLabels
    );

    const requiredLabels = parseCommaSeparatedString(
      isPr ? args.requiredPrLabels : args.requiredIssueLabels
    );

    const responseRequestedLabel = isPr
      ? args.responseRequestedLabel
      : args.responseRequestedLabel;

    const issueTimelineEvents = await getTimelineEvents(client, issue);
    const currentTime = new Date(Date.now());

    if (requiredLabels && requiredLabels.length && !(requiredLabels.some((s) => isLabeled(issue, s)))) {
      // If issue does not contain a required label, do nothing
      log.debug(`issue does not contain a required label`);
      return;
    }

    if (exemptLabels && exemptLabels.length && exemptLabels.some((s) => isLabeled(issue, s))) {
      // If issue contains exempt label, do nothing
      log.debug(`issue contains exempt label`);
      return;
    }

    if (isLabeled(issue, staleLabel)) {
      log.debug(`issue contains the stale label`);
      const lastCommentTime = getLastCommentTime(issueTimelineEvents);
      const staleLabelTime = getLastLabelTime(issueTimelineEvents, staleLabel);
      const sTime = new Date(
        lastCommentTime + MS_PER_DAY * args.daysBeforeClose
      );

      // This happens when we can't determine the time of labeling stale
      // but GitHub told us it has a stale label on it.
      if (staleLabelTime === undefined) {
        log.warn('Skipping this issue');
        return;
      }

      if (lastCommentTime > staleLabelTime) {
        log.debug('issue was commented on after the label was applied');
        if (args.dryrun) {
          log.info(
            `dry run: would remove ${staleLabel} and ${responseRequestedLabel} labels for #${issue.number}`
          );
        } else {
          await removeLabel(client, issue, staleLabel);
          if (isLabeled(issue, responseRequestedLabel)) {
            await removeLabel(client, issue, responseRequestedLabel);
          }
        }
      } else {
        if (currentTime > sTime) {
          log.debug(`time expired on this issue, need to close it`);
          if (args.dryrun) {
            log.info(
              `dry run: would remove ${staleLabel} for #${issue.number} and close`
            );
          } else {
            await removeLabel(client, issue, staleLabel);
            await closeIssue(client, issue, args.cfsLabel);
          }
        } else {
          // else ignore it because we need to wait longer before closing
          log.debug(
            `${dateFormatToIsoUtc(
              currentTime
            )} is less than ${dateFormatToIsoUtc(sTime)}, doing nothing`
          );
        }
      }
    } else if (isLabeled(issue, responseRequestedLabel)) {
      const lastCommentTime = getLastCommentTime(issueTimelineEvents);
      // const lastUpdateTme = Date.parse(issue.updated_at);
      const rrLabelTime = getLastLabelTime(
        issueTimelineEvents,
        responseRequestedLabel
      );
      const rrTime = new Date(
        lastCommentTime + MS_PER_DAY * args.daysBeforeStale
      );
      if (lastCommentTime > rrLabelTime) {
        log.debug(`issue was commented on after the label was applied`);
        if (args.dryrun) {
          log.info(
            `dry run: would remove ${responseRequestedLabel} from #${issue.number}`
          );
        } else {
          await removeLabel(client, issue, responseRequestedLabel);
        }
      } else {
        if (currentTime >= rrTime) {
          if (staleMessage) {
            log.debug(`time expired on this issue, need to label it stale`);
            if (args.dryrun) {
              log.info(
                `dry run: would mark #${issue.number} as ${staleLabel} due to ${responseRequestedLabel} age`
              );
            } else {
              await markStale(client, issue, staleMessage, staleLabel);
            }
          }
          else {
            log.debug(`stale message is null/empty, doing nothing`);
          }
        } else {
          // else ignore it because we need to wait longer before staleing
          log.debug(
            `${dateFormatToIsoUtc(
              currentTime
            )} is less than ${dateFormatToIsoUtc(rrTime)}, doing nothing`
          );
        }
      }
    } else if (
      Date.parse(issue.updated_at) <
      new Date(Date.now() - MS_PER_DAY * args.daysBeforeAncient)
    ) {
      if (typeof args.minimumUpvotesToExempt !== 'undefined') {
        if (
          await hasEnoughUpvotes(
            client,
            issue.number,
            args.minimumUpvotesToExempt
          )
        ) {
          log.debug('issue is ancient but has enough upvotes to exempt');
        } else {
          log.debug('issue is ancient and not enough upvotes; marking stale');
          if (args.dryrun) {
            log.info(
              `dry run: would mark #${issue.number} as ${staleLabel} due to last updated age`
            );
          } else {
            await markStale(client, issue, ancientMessage, staleLabel);
          }
        }
      } else {
        log.debug('issue is ancient and not enough upvotes; marking stale');
        if (args.dryrun) {
          log.info(
            `dry run: would mark #${issue.number} as ${staleLabel} due to last updated age`
          );
        } else {
          await markStale(client, issue, ancientMessage, staleLabel);
        }
      }
    }
  });
}

const run = async () => {
  try {
    log.info('Starting issue processing');
    const args = getAndValidateInputs();
    log.debug(args);
    const client = new github.GitHub(args.repoToken);
    await processIssues(client, args);
    log.info('Labelled issue processing complete');
    process.exitCode = 0;
  } catch (e) /* istanbul ignore next */ {
    log.error(`failed to run action: ${e}`);
    process.exitCode = 1;
  }
};

module.exports = {
  run: run,
  getAndValidateInputs: getAndValidateInputs,
};

/* istanbul ignore next */
if (require.main === module) {
  run();
}
